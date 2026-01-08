import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Camera, MapPin, Upload, X, Search, Check, Loader2, Navigation } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";

interface PinballLocation {
  id: number;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: string;
  lon: string;
  num_machines: number;
  distance?: number;
}

interface PinballMachine {
  id: number;
  name: string;
  manufacturer: string;
  year: number;
}

interface DetectedScore {
  player: string;
  score: number;
  formatted: string;
}

const Capture = () => {
  const [step, setStep] = useState(1);
  const [selectedLocation, setSelectedLocation] = useState<PinballLocation | null>(null);
  const [selectedMachine, setSelectedMachine] = useState("");
  const [scoreImage, setScoreImage] = useState<File | null>(null);
  const [scoreImagePreview, setScoreImagePreview] = useState<string | null>(null);
  const [score, setScore] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isLoadingMachines, setIsLoadingMachines] = useState(false);
  const [locations, setLocations] = useState<PinballLocation[]>([]);
  const [nearbyLocations, setNearbyLocations] = useState<PinballLocation[]>([]);
  const [machines, setMachines] = useState<PinballMachine[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [machineSearchQuery, setMachineSearchQuery] = useState("");
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [searchedViaApi, setSearchedViaApi] = useState(false);
  const [detectedScores, setDetectedScores] = useState<DetectedScore[]>([]);
  const [isExtractingScores, setIsExtractingScores] = useState(false);
  const [lastScoreLocation, setLastScoreLocation] = useState<string | null>(null);
  const [skippedLocationStep, setSkippedLocationStep] = useState(false);
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Fetch user's last score location
  useEffect(() => {
    const fetchLastScore = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("scores")
        .select("location_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (data && !error) {
        setLastScoreLocation(data.location_name);
      }
    };
    
    fetchLastScore();
  }, [user]);

  // Get user's GPS location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      setIsLoadingLocations(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          setUserLocation(coords);
          fetchNearbyLocations(coords.lat, coords.lon);
        },
        (error) => {
          console.log("Geolocation error:", error.code, error.message);
          // Don't show error - just show empty state with search option
          setIsLoadingLocations(false);
          setLocationError(null); // Clear any previous error
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
      );
    } else {
      setIsLoadingLocations(false);
    }
  }, []);

  // Auto-select last location if nearby
  useEffect(() => {
    if (lastScoreLocation && locations.length > 0 && step === 1 && !selectedLocation) {
      const matchingLocation = locations.find(
        (loc) => loc.name.toLowerCase() === lastScoreLocation.toLowerCase()
      );
      
      if (matchingLocation) {
        setSelectedLocation(matchingLocation);
        fetchMachinesForLocation(matchingLocation.id);
        setSkippedLocationStep(true);
        setStep(2);
        toast({
          title: "Welcome back! 🎮",
          description: `Continuing at ${matchingLocation.name}`,
        });
      }
    }
  }, [lastScoreLocation, locations]);
  const fetchNearbyLocations = async (lat: number, lon: number) => {
    setIsLoadingLocations(true);
    try {
      const response = await fetch(
        `https://pinballmap.com/api/v1/locations/closest_by_lat_lon.json?lat=${lat}&lon=${lon}&max_distance=50&send_all_within_distance=1`
      );
      const data = await response.json();
      
      if (data.locations && Array.isArray(data.locations)) {
        // Calculate distance for each location
        const locationsWithDistance = data.locations.map((loc: PinballLocation) => ({
          ...loc,
          distance: calculateDistance(lat, lon, parseFloat(loc.lat), parseFloat(loc.lon)),
        }));
        const limitedLocations = locationsWithDistance.slice(0, 20);
        setLocations(limitedLocations);
        setNearbyLocations(limitedLocations); // Keep original nearby list
      } else if (data.location) {
        // Single location returned
        const loc = data.location;
        const singleLocation = [{
          ...loc,
          distance: calculateDistance(lat, lon, parseFloat(loc.lat), parseFloat(loc.lon)),
        }];
        setLocations(singleLocation);
        setNearbyLocations(singleLocation);
      } else {
        setLocations([]);
        setNearbyLocations([]);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
      toast({
        title: "Error",
        description: "Failed to fetch nearby arcades",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLocations(false);
    }
  };

  const fetchMachinesForLocation = async (locationId: number) => {
    setIsLoadingMachines(true);
    try {
      const response = await fetch(
        `https://pinballmap.com/api/v1/locations/${locationId}/machine_details.json`
      );
      const data = await response.json();
      
      if (data.machines && Array.isArray(data.machines)) {
        setMachines(data.machines.map((m: any) => ({
          id: m.id,
          name: m.name,
          manufacturer: m.manufacturer || "",
          year: m.year || 0,
        })));
      } else {
        setMachines([]);
      }
    } catch (error) {
      console.error("Error fetching machines:", error);
      toast({
        title: "Error",
        description: "Failed to fetch machines for this location",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMachines(false);
    }
  };

  const searchLocationsByCity = async (city: string) => {
    if (!city.trim()) return;
    
    setIsSearchingApi(true);
    try {
      const response = await fetch(
        `https://pinballmap.com/api/v1/locations/closest_by_address.json?address=${encodeURIComponent(city)}&max_distance=50&send_all_within_distance=1`
      );
      const data = await response.json();
      
      if (data.locations && Array.isArray(data.locations)) {
        setLocations(data.locations.slice(0, 20));
        setSearchedViaApi(true);
      } else if (data.location) {
        setLocations([data.location]);
        setSearchedViaApi(true);
      } else {
        setLocations([]);
        setSearchedViaApi(true);
      }
    } catch (error) {
      console.error("Error searching locations:", error);
      toast({
        title: "Search Error",
        description: "Failed to search for locations in that city",
        variant: "destructive",
      });
    } finally {
      setIsSearchingApi(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatDistance = (distance?: number): string => {
    if (!distance) return "";
    return distance < 1 ? `${(distance * 5280).toFixed(0)} ft` : `${distance.toFixed(1)} mi`;
  };

  const handleLocationSelect = (location: PinballLocation) => {
    setSelectedLocation(location);
    fetchMachinesForLocation(location.id);
    setStep(2);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScoreImage(file);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setScoreImagePreview(base64);
        setStep(3);
        
        // Extract scores from image using AI
        setIsExtractingScores(true);
        setDetectedScores([]);
        try {
          const { data, error } = await supabase.functions.invoke("extract-scores", {
            body: { imageBase64: base64 },
          });
          
          if (error) throw error;
          
          if (data.scores && Array.isArray(data.scores) && data.scores.length > 0) {
            setDetectedScores(data.scores);
            toast({
              title: "Scores detected! 🎯",
              description: `Found ${data.scores.length} score(s) in your photo`,
            });
          }
        } catch (error) {
          console.error("Failed to extract scores:", error);
          // Silently fail - user can still enter score manually
        } finally {
          setIsExtractingScores(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedLocation || !selectedMachine || !score) return;

    setIsSubmitting(true);

    try {
      let photoUrl = null;

      // Upload photo if present
      if (scoreImage) {
        const fileExt = scoreImage.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError, data } = await supabase.storage
          .from("score-photos")
          .upload(fileName, scoreImage);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("score-photos")
          .getPublicUrl(fileName);

        photoUrl = urlData.publicUrl;
      }

      // Parse score (remove commas)
      const numericScore = parseInt(score.replace(/,/g, ""), 10);

      // Insert score
      const { error } = await supabase.from("scores").insert({
        user_id: user.id,
        score: numericScore,
        machine_name: selectedMachine,
        location_name: selectedLocation.name,
        latitude: parseFloat(selectedLocation.lat),
        longitude: parseFloat(selectedLocation.lon),
        photo_url: photoUrl,
      });

      if (error) throw error;

      // Update last score location to the one just submitted
      setLastScoreLocation(selectedLocation.name);

      toast({
        title: "Score submitted! 🎯",
        description: "Your score has been added to the leaderboard.",
      });

      // Reset form
      setStep(1);
      setSelectedLocation(null);
      setSelectedMachine("");
      setScoreImage(null);
      setScoreImagePreview(null);
      setScore("");
      setSkippedLocationStep(false);

      navigate("/leaderboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit score",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter from current list (nearby or API results)
  const filteredLocations = locations.filter(
    (loc) =>
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if we should show "search wider" option
  const showSearchWider = searchQuery.trim().length >= 2 && filteredLocations.length === 0 && !isSearchingApi && !searchedViaApi;

  // Reset to nearby when search is cleared
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setLocations(nearbyLocations);
      setSearchedViaApi(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-24 flex items-center justify-center min-h-[80vh]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center bg-card rounded-2xl p-10 max-w-md border border-border shadow-sm"
          >
            <Camera className="mx-auto mb-4 text-primary" size={48} />
            <h1 className="text-xl font-bold text-foreground mb-2">
              Sign in required
            </h1>
            <p className="text-muted-foreground mb-6">
              Sign in to capture and submit your high scores.
            </p>
            <Link to="/auth">
              <Button variant="gradient" size="lg">
                Sign In
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-24 max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <Camera className="text-primary" size={28} />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Capture Score</h1>
          </div>
          <p className="text-muted-foreground">
            Upload your high score photo to join the leaderboard
          </p>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 mb-10"
        >
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
                animate={step === s ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 1, repeat: step === s ? Infinity : 0 }}
              >
                {step > s ? <Check size={16} /> : s}
              </motion.div>
              {s < 3 && (
                <div className={`w-8 h-0.5 ${step > s ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </motion.div>

        {/* Step 1: Select Location */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card rounded-2xl p-6 border border-border shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <MapPin className="text-secondary" size={20} />
                <h2 className="font-semibold text-foreground">Select Location</h2>
              </div>
              {userLocation && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Navigation size={12} />
                  <span>GPS Active</span>
                </div>
              )}
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Filter nearby or search by city..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            {locationError && (
              <div className="p-4 bg-destructive/10 rounded-lg mb-4 text-center">
                <p className="text-destructive text-sm">{locationError}</p>
              </div>
            )}

            {isLoadingLocations ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="animate-spin text-primary mb-3" size={32} />
                <p className="text-muted-foreground text-sm">Finding nearby arcades...</p>
              </div>
            ) : isSearchingApi ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="animate-spin text-primary mb-3" size={32} />
                <p className="text-muted-foreground text-sm">Searching "{searchQuery}"...</p>
              </div>
            ) : showSearchWider ? (
              <div className="text-center py-12">
                <MapPin className="mx-auto mb-3 text-muted-foreground" size={32} />
                <p className="text-muted-foreground">No nearby arcades match "{searchQuery}"</p>
                <p className="text-muted-foreground text-sm mt-2">Enter a city name to search elsewhere</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => searchLocationsByCity(searchQuery)}
                >
                  <Search size={16} className="mr-2" />
                  Search arcades in "{searchQuery}"
                </Button>
              </div>
            ) : filteredLocations.length === 0 && !searchQuery ? (
              <div className="text-center py-12">
                <MapPin className="mx-auto mb-3 text-muted-foreground" size={32} />
                <p className="text-muted-foreground">
                  {userLocation ? "No arcades found nearby" : "Enter a city to find arcades"}
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  Search by city name above
                </p>
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="mx-auto mb-3 text-muted-foreground" size={32} />
                <p className="text-muted-foreground">
                  {searchedViaApi ? `No arcades found in "${searchQuery}"` : `No results for "${searchQuery}"`}
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  {searchedViaApi ? "Try a different city name" : "Try searching by city name"}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredLocations.map((location) => (
                  <motion.button
                    key={location.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleLocationSelect(location)}
                    className="w-full p-4 rounded-xl text-left transition-all bg-muted/50 border border-transparent hover:border-border"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{location.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {location.street}, {location.city}, {location.state}
                        </p>
                        <p className="text-xs text-primary mt-1">
                          {location.num_machines} machine{location.num_machines !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="text-xs text-secondary font-medium ml-2 whitespace-nowrap">
                        {formatDistance(location.distance)}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Step 2: Select Machine & Upload Photo */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card rounded-2xl p-6 border border-border shadow-sm"
          >
            <button
              onClick={() => {
                setStep(1);
                setMachineSearchQuery("");
                setSkippedLocationStep(false);
              }}
              className="text-muted-foreground text-sm mb-4 hover:text-foreground transition-colors"
            >
              ← {skippedLocationStep ? "Choose different location" : "Back to locations"}
            </button>

            <div className="p-3 bg-muted/50 rounded-lg mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-foreground">{selectedLocation?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedLocation?.street}, {selectedLocation?.city}, {selectedLocation?.state}
                  </p>
                </div>
                {skippedLocationStep && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    Last visit
                  </span>
                )}
              </div>
            </div>

            <div className="mb-6">
              <Label className="text-foreground mb-3 block">Select Machine ({machines.length} available)</Label>
              
              {isLoadingMachines ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              ) : machines.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No machines found at this location</p>
                </div>
              ) : (
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      placeholder="Filter machines..."
                      className="pl-9"
                      value={machineSearchQuery}
                      onChange={(e) => setMachineSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                    {machines
                      .filter((m) => 
                        m.name.toLowerCase().includes(machineSearchQuery.toLowerCase()) ||
                        m.manufacturer?.toLowerCase().includes(machineSearchQuery.toLowerCase())
                      )
                      .map((machine) => (
                        <motion.button
                          key={machine.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedMachine(machine.name)}
                          className={`p-3 rounded-lg text-sm text-left transition-all ${
                            selectedMachine === machine.name
                              ? "bg-primary/10 border border-primary text-primary"
                              : "bg-muted/50 border border-transparent text-foreground hover:border-border"
                          }`}
                        >
                          <span className="font-medium">{machine.name}</span>
                          {(machine.manufacturer || machine.year > 0) && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {machine.manufacturer} {machine.year > 0 && `(${machine.year})`}
                            </span>
                          )}
                        </motion.button>
                      ))}
                    {machines.filter((m) => 
                      m.name.toLowerCase().includes(machineSearchQuery.toLowerCase()) ||
                      m.manufacturer?.toLowerCase().includes(machineSearchQuery.toLowerCase())
                    ).length === 0 && (
                      <p className="text-center text-muted-foreground text-sm py-4">
                        No machines match "{machineSearchQuery}"
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {selectedMachine && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Label className="text-foreground mb-3 block">Upload Score Photo</Label>
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                  <Upload className="text-muted-foreground mb-2" size={32} />
                  <span className="text-sm text-muted-foreground">
                    Click to upload or drag & drop
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    PNG, JPG up to 10MB
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Step 3: Confirm & Submit */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card rounded-2xl p-6 border border-border shadow-sm"
          >
            <button
              onClick={() => setStep(2)}
              className="text-muted-foreground text-sm mb-4 hover:text-foreground transition-colors"
            >
              ← Back
            </button>

            <h2 className="font-semibold text-foreground mb-6">Confirm Your Score</h2>

            {scoreImagePreview && (
              <div className="relative mb-6 bg-muted/30 rounded-xl overflow-hidden">
                <img
                  src={scoreImagePreview}
                  alt="Score"
                  className="w-full max-h-96 object-contain"
                />
                <button
                  onClick={() => {
                    setScoreImage(null);
                    setScoreImagePreview(null);
                    setStep(2);
                  }}
                  className="absolute top-2 right-2 p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Location</span>
                <span className="text-foreground font-medium">{selectedLocation?.name}</span>
              </div>
              <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Machine</span>
                <span className="text-foreground font-medium">{selectedMachine}</span>
              </div>
              <div>
                <Label className="text-foreground mb-2 block">
                  {isExtractingScores ? "Analyzing photo..." : detectedScores.length > 0 ? "Select or enter your score" : "Enter Your Score"}
                </Label>
                
                {isExtractingScores && (
                  <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg mb-3">
                    <Loader2 className="animate-spin text-primary" size={16} />
                    <span className="text-sm text-primary">Detecting scores from photo...</span>
                  </div>
                )}
                
                {detectedScores.length > 0 && (
                  <div className="space-y-2 mb-3">
                    <p className="text-xs text-muted-foreground">Detected scores (tap to select):</p>
                    <div className="grid grid-cols-2 gap-2">
                      {detectedScores.map((detected, index) => (
                        <motion.button
                          key={index}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setScore(detected.formatted)}
                          className={`p-3 rounded-lg text-left transition-all ${
                            score === detected.formatted
                              ? "bg-primary/10 border border-primary"
                              : "bg-muted/50 border border-transparent hover:border-border"
                          }`}
                        >
                          <span className="text-xs text-muted-foreground block">Player {detected.player}</span>
                          <span className={`font-bold ${score === detected.formatted ? "text-primary" : "text-foreground"}`}>
                            {detected.formatted}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
                
                <Input
                  type="text"
                  placeholder="12,345,678"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="text-lg font-semibold"
                />
              </div>
            </div>

            <Button
              variant="gradient"
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={!score || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <Upload size={18} />
                  Submit Score
                </>
              )}
            </Button>
          </motion.div>
        )}
      </div>

      <div className="h-20 md:h-0" />
    </div>
  );
};

export default Capture;
