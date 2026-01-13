import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, MapPin, Upload, X, Search, Check, Loader2, Navigation, Plus } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { createNotification, NotificationTypes } from "@/hooks/useNotifications";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

interface AllMachine {
  id: number;
  name: string;
  manufacturer: string;
  year: number;
}

const Capture = () => {
  const { t } = useTranslation();
  const { useMetric } = useLanguage();
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
  const [lastScoreLocationId, setLastScoreLocationId] = useState<number | null>(null);
  const [lastScoreLocationCoords, setLastScoreLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [skippedLocationStep, setSkippedLocationStep] = useState(false);
  
  // Add machine modal state
  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [allMachines, setAllMachines] = useState<AllMachine[]>([]);
  const [isLoadingAllMachines, setIsLoadingAllMachines] = useState(false);
  const [addMachineSearch, setAddMachineSearch] = useState("");
  const [isAddingMachine, setIsAddingMachine] = useState(false);
  
  const { toast } = useToast();
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Fetch user's last location from profile
  useEffect(() => {
    const fetchLastLocation = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("last_location_id, last_location_name, last_location_lat, last_location_lon")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return;

      if (data?.last_location_name) setLastScoreLocation(data.last_location_name);
      if (typeof data?.last_location_id === "number") setLastScoreLocationId(data.last_location_id);
      if (typeof data?.last_location_lat === "number" && typeof data?.last_location_lon === "number") {
        setLastScoreLocationCoords({ lat: data.last_location_lat, lon: data.last_location_lon });
      }
    };

    fetchLastLocation();
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

  // Auto-select last location when user is still near it
  useEffect(() => {
    const maybeAutoSelect = async () => {
      if (step !== 1 || selectedLocation || skippedLocationStep) return;
      if (!lastScoreLocationId || !lastScoreLocationCoords || !userLocation) return;

      const distanceToLast = calculateDistance(
        userLocation.lat,
        userLocation.lon,
        lastScoreLocationCoords.lat,
        lastScoreLocationCoords.lon
      );

      // Consider "same location" if within ~0.25 miles
      if (distanceToLast > 0.25) return;

      const locationDetails = await fetchLocationDetails(lastScoreLocationId);
      if (!locationDetails) return;

      setSelectedLocation(locationDetails);
      fetchMachinesForLocation(locationDetails.id);
      setSkippedLocationStep(true);
      setStep(2);
      toast({
        title: t("toastCapture.welcomeBackTitle"),
        description: t("toastCapture.welcomeBackDesc", { location: locationDetails.name }),
      });
    };

    maybeAutoSelect();
  }, [userLocation, lastScoreLocationId, lastScoreLocationCoords, step, selectedLocation, skippedLocationStep]);
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
        title: t("toastCapture.errorTitle"),
        description: t("toastCapture.failedFetchArcades"),
        variant: "destructive",
      });
    } finally {
      setIsLoadingLocations(false);
    }
  };

  const fetchMachinesForLocation = async (locationId: number) => {
    setIsLoadingMachines(true);
    try {
      // Fetch from Pinball Map API
      const response = await fetch(
        `https://pinballmap.com/api/v1/locations/${locationId}/machine_details.json`
      );
      const data = await response.json();
      
      let apiMachines: PinballMachine[] = [];
      if (data.machines && Array.isArray(data.machines)) {
        apiMachines = data.machines.map((m: any) => ({
          id: m.id,
          name: m.name,
          manufacturer: m.manufacturer || "",
          year: m.year || 0,
        }));
      }
      
      // Fetch locally-added machines from our database
      const { data: localMachines, error } = await supabase
        .from("local_machines")
        .select("*")
        .eq("location_id", locationId);
      
      if (!error && localMachines) {
        // Merge local machines with API machines, avoiding duplicates
        const localMachinesMapped: PinballMachine[] = localMachines
          .filter(lm => !apiMachines.some(am => am.id === lm.machine_id))
          .map(lm => ({
            id: lm.machine_id,
            name: lm.machine_name,
            manufacturer: lm.manufacturer || "",
            year: lm.year || 0,
          }));
        
        setMachines([...apiMachines, ...localMachinesMapped]);
      } else {
        setMachines(apiMachines);
      }
    } catch (error) {
      console.error("Error fetching machines:", error);
      toast({
        title: t("toastCapture.errorTitle"),
        description: t("toastCapture.failedFetchMachines"),
        variant: "destructive",
      });
    } finally {
      setIsLoadingMachines(false);
    }
  };

  const fetchLocationDetails = async (locationId: number): Promise<PinballLocation | null> => {
    try {
      const response = await fetch(
        `https://pinballmap.com/api/v1/locations/${locationId}.json`
      );
      const data = await response.json();
      const loc = data?.location;
      if (!loc) return null;

      return {
        id: loc.id,
        name: loc.name,
        street: loc.street || "",
        city: loc.city || "",
        state: loc.state || "",
        zip: loc.zip || "",
        lat: String(loc.lat ?? ""),
        lon: String(loc.lon ?? ""),
        num_machines: loc.num_machines || 0,
      };
    } catch (e) {
      console.error("Error fetching location details:", e);
      return null;
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
        title: t("toastCapture.searchError"),
        description: t("toastCapture.failedSearchCity"),
        variant: "destructive",
      });
    } finally {
      setIsSearchingApi(false);
    }
  };

  const fetchAllMachines = async () => {
    if (allMachines.length > 0) return; // Already loaded
    
    setIsLoadingAllMachines(true);
    try {
      const response = await fetch(
        `https://pinballmap.com/api/v1/machines.json`
      );
      const data = await response.json();
      
      if (data.machines && Array.isArray(data.machines)) {
        setAllMachines(data.machines.map((m: any) => ({
          id: m.id,
          name: m.name,
          manufacturer: m.manufacturer || "",
          year: m.year || 0,
        })));
      }
    } catch (error) {
      console.error("Error fetching all machines:", error);
      toast({
        title: t("toastCapture.errorTitle"),
        description: t("toastCapture.failedLoadMachineDb"),
        variant: "destructive",
      });
    } finally {
      setIsLoadingAllMachines(false);
    }
  };

  const addMachineToLocation = async (machine: AllMachine) => {
    if (!selectedLocation || !user) return;
    
    setIsAddingMachine(true);
    try {
      // Call backend function to add machine
      if (!session?.access_token) {
        throw new Error(t("toastCapture.notAuthenticated"));
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pinballmap-add-machine`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            location_id: selectedLocation.id,
            machine_id: machine.id,
          }),
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        // Save to local_machines table for immediate visibility
        await supabase.from("local_machines").insert({
          location_id: selectedLocation.id,
          location_name: selectedLocation.name,
          machine_id: machine.id,
          machine_name: machine.name,
          manufacturer: machine.manufacturer || null,
          year: machine.year || null,
          added_by: user.id,
        });
        
        // Add to local machines list
        setMachines(prev => [...prev, {
          id: machine.id,
          name: machine.name,
          manufacturer: machine.manufacturer,
          year: machine.year,
        }]);
        
        // Select the newly added machine
        setSelectedMachine(machine.name);
        setShowAddMachineModal(false);
        setAddMachineSearch("");
        
        toast({
          title: t("toastCapture.machineAddedTitle"),
          description: t("toastCapture.machineAddedDesc", { machine: machine.name, location: selectedLocation.name }),
        });
      } else {
        throw new Error(data.errors || t("toastCapture.failedAddMachine"));
      }
    } catch (error: any) {
      console.error("Error adding machine:", error);
      toast({
        title: t("toastCapture.errorTitle"),
        description: error.message || t("toastCapture.failedAddMachine"),
        variant: "destructive",
      });
    } finally {
      setIsAddingMachine(false);
    }
  };

  const openAddMachineModal = () => {
    setShowAddMachineModal(true);
    setAddMachineSearch(machineSearchQuery); // Pre-fill with current search
    fetchAllMachines();
  };

  // Filter all machines - exclude ones already at location
  const filteredAllMachines = allMachines
    .filter(m => !machines.some(lm => lm.id === m.id))
    .filter(m => 
      m.name.toLowerCase().includes(addMachineSearch.toLowerCase()) ||
      m.manufacturer?.toLowerCase().includes(addMachineSearch.toLowerCase())
    )
    .slice(0, 50);

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
    if (useMetric) {
      const km = distance * 1.60934;
      return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(1)} km`;
    }
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
              title: t("toastCapture.scoresDetectedTitle"),
              description: t("toastCapture.scoresDetected", { count: data.scores.length }),
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
      let validationStatus: string | null = null;

      // Parse score (remove commas)
      const numericScore = parseInt(score.replace(/,/g, ""), 10);

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

        // Validate the image with AI
        try {
          const { data: validationData, error: validationError } = await supabase.functions.invoke("extract-scores", {
            body: { 
              imageBase64: scoreImagePreview, 
              validateMachine: selectedMachine,
              validateScore: numericScore 
            },
          });
          
          if (!validationError && validationData?.validation) {
            const { machineMatch, scoreMatch } = validationData.validation;
            
            if (machineMatch && scoreMatch) {
              validationStatus = "accepted";
            } else {
              validationStatus = "pending";
            }
          }
        } catch (validationErr) {
          console.error("AI validation failed:", validationErr);
          // Continue without validation
        }
      }

      // Insert score without GPS coordinates for privacy
      const { error } = await supabase.from("scores").insert({
        user_id: user.id,
        score: numericScore,
        machine_name: selectedMachine,
        location_name: selectedLocation.name,
        photo_url: photoUrl,
        validation_status: validationStatus || "pending",
        user_notified_at: validationStatus === "accepted" ? new Date().toISOString() : null,
      });

      if (error) throw error;

      // Save last location to user profile (persists across sessions)
      await supabase
        .from("profiles")
        .update({
          last_location_id: selectedLocation.id,
          last_location_name: selectedLocation.name,
          last_location_lat: parseFloat(selectedLocation.lat),
          last_location_lon: parseFloat(selectedLocation.lon),
          last_location_updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      setLastScoreLocation(selectedLocation.name);
      setLastScoreLocationId(selectedLocation.id);
      setLastScoreLocationCoords({ lat: parseFloat(selectedLocation.lat), lon: parseFloat(selectedLocation.lon) });

      // Show notification and toast based on validation status
      if (validationStatus === "accepted") {
        await createNotification({
          userId: user.id,
          type: NotificationTypes.SCORE_VERIFIED,
          title: t("notificationCapture.scoreVerifiedByAiTitle"),
          message: t("notificationCapture.scoreVerifiedByAiMessage", { score: numericScore.toLocaleString(), machine: selectedMachine }),
          data: { machine: selectedMachine, score: numericScore },
        });
        toast({
          title: t("toastCapture.scoreVerifiedByAiTitle"),
          description: t("toastCapture.scoreVerifiedByAiDesc"),
        });
      } else {
        // All other statuses (pending, null, etc.) are pending community review
        await createNotification({
          userId: user.id,
          type: NotificationTypes.SCORE_PENDING,
          title: t("notificationCapture.scoreSubmittedTitle"),
          message: t("notificationCapture.scoreSubmittedMessage", { score: numericScore.toLocaleString(), machine: selectedMachine }),
          data: { machine: selectedMachine, score: numericScore },
        });
        toast({
          title: t("toastCapture.scoreSubmittedTitle"),
          description: t("toastCapture.scoreSubmittedDesc"),
        });
      }

      // Reset form
      setStep(1);
      setSelectedLocation(null);
      setSelectedMachine("");
      setScoreImage(null);
      setScoreImagePreview(null);
      setScore("");
      setSkippedLocationStep(false);

      navigate(`/leaderboard?machine=${encodeURIComponent(selectedMachine)}`);
    } catch (error: any) {
      toast({
        title: t("toastCapture.errorTitle"),
        description: error.message || t("toastCapture.failedSubmitScore"),
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
      <PageLayout>
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </PageLayout>
    );
  }

  if (!user) {
    return (
      <PageLayout>
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
      </PageLayout>
    );
  }

  return (
    <PageLayout>
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
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("capture.title")}</h1>
          </div>
          <p className="text-muted-foreground">
            {t("capture.subtitle")}
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
                    : "bg-card text-muted-foreground border border-border"
                }`}
                animate={step === s ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 1, repeat: step === s ? Infinity : 0 }}
              >
                {step > s ? <Check size={16} /> : s}
              </motion.div>
              {s < 3 && (
                <div className={`w-8 h-0.5 ${step > s ? "bg-primary" : "bg-card"}`} />
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
                <h2 className="font-semibold text-foreground">{t("capture.selectLocation")}</h2>
              </div>
              {userLocation && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Navigation size={12} />
                  <span>{t("capture.gpsActive")}</span>
                </div>
              )}
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder={t("capture.searchPlaceholder")}
                className="pl-10"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    searchLocationsByCity(searchQuery);
                  }
                }}
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
                <p className="text-muted-foreground text-sm">{t("capture.findingArcades")}</p>
              </div>
            ) : isSearchingApi ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="animate-spin text-primary mb-3" size={32} />
                <p className="text-muted-foreground text-sm">{t("capture.searching")} "{searchQuery}"...</p>
              </div>
            ) : showSearchWider ? (
              <div className="text-center py-12">
                <MapPin className="mx-auto mb-3 text-muted-foreground" size={32} />
                <p className="text-muted-foreground">{t("capture.noNearbyMatch")} "{searchQuery}"</p>
                <p className="text-muted-foreground text-sm mt-2">{t("capture.enterCityToSearch")}</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => searchLocationsByCity(searchQuery)}
                >
                  <Search size={16} className="mr-2" />
                  {t("capture.searchArcadesIn")} "{searchQuery}"
                </Button>
              </div>
            ) : filteredLocations.length === 0 && !searchQuery ? (
              <div className="text-center py-12">
                <MapPin className="mx-auto mb-3 text-muted-foreground" size={32} />
                <p className="text-muted-foreground">
                  {userLocation ? t("capture.noArcadesFound") : t("capture.enterCityToFind")}
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  {t("capture.searchByCityAbove")}
                </p>
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="mx-auto mb-3 text-muted-foreground" size={32} />
                <p className="text-muted-foreground">
                  {searchedViaApi ? `${t("capture.noArcadesInCity")} "${searchQuery}"` : `${t("capture.noResultsFor")} "${searchQuery}"`}
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  {searchedViaApi ? t("capture.tryDifferentCity") : t("capture.trySearchingByCity")}
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
                          {location.num_machines} {location.num_machines !== 1 ? t("capture.machines") : t("capture.machine")}
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
              ← {skippedLocationStep ? t("capture.chooseDifferentLocation") : t("capture.backToLocations")}
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
                    {t("capture.lastVisit")}
                  </span>
                )}
              </div>
            </div>

            <div className="mb-6">
              <Label className="text-foreground mb-3 block">{t("capture.selectMachine")} ({machines.length} {t("capture.available")})</Label>
              
              {isLoadingMachines ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              ) : machines.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">{t("capture.noMachinesFound")}</p>
                </div>
              ) : (
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      placeholder={t("capture.filterMachines")}
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
                        {t("capture.noMachinesMatch")} "{machineSearchQuery}"
                      </p>
                    )}
                  </div>
                  
                  {/* Add Machine Button */}
                  <Button
                    variant="outline"
                    className="w-full mt-3"
                    onClick={openAddMachineModal}
                  >
                    <Plus size={16} className="mr-2" />
                    {t("capture.machineNotListed")}
                  </Button>
                </>
              )}
            </div>

            {selectedMachine && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Label className="text-foreground mb-3 block">{t("capture.uploadScorePhoto")}</Label>
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                  <Upload className="text-muted-foreground mb-2" size={32} />
                  <span className="text-sm text-muted-foreground">
                    {t("capture.clickToUpload")}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {t("capture.maxFileSize")}
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
              ← {t("capture.back")}
            </button>

            <h2 className="font-semibold text-foreground mb-6">{t("capture.confirmYourScore")}</h2>

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
                <span className="text-muted-foreground">{t("capture.location")}</span>
                <span className="text-foreground font-medium">{selectedLocation?.name}</span>
              </div>
              <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">{t("capture.machine")}</span>
                <span className="text-foreground font-medium">{selectedMachine}</span>
              </div>
              <div>
                <Label className="text-foreground mb-2 block">
                  {isExtractingScores ? t("capture.analyzingPhoto") : detectedScores.length > 0 ? t("capture.selectOrEnterScore") : t("capture.enterYourScore")}
                </Label>
                
                {isExtractingScores && (
                  <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg mb-3">
                    <Loader2 className="animate-spin text-primary" size={16} />
                    <span className="text-sm text-primary">{t("capture.detectingScores")}</span>
                  </div>
                )}
                
                {detectedScores.length > 0 && (
                  <div className="space-y-2 mb-3">
                    <p className="text-xs text-muted-foreground">{t("capture.detectedScores")}</p>
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
                          <span className="text-xs text-muted-foreground block">{t("capture.player")} {detected.player}</span>
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
                  {t("capture.submitScore")}
                </>
              )}
            </Button>
          </motion.div>
        )}
      </div>

      <div className="h-20 md:h-0" />

      {/* Add Machine Modal */}
      <Dialog open={showAddMachineModal} onOpenChange={setShowAddMachineModal}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={20} className="text-primary" />
              {t("capture.addMachineTitle")} {selectedLocation?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder={t("capture.searchAllMachines")}
                className="pl-9"
                value={addMachineSearch}
                onChange={(e) => setAddMachineSearch(e.target.value)}
                autoFocus
              />
            </div>
            
            {isLoadingAllMachines ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="animate-spin text-primary mb-3" size={32} />
                <p className="text-muted-foreground text-sm">{t("capture.loadingMachineDb")}</p>
              </div>
            ) : addMachineSearch.length < 2 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t("capture.typeToSearch")}</p>
                <p className="text-sm mt-1">{allMachines.length.toLocaleString()} {t("capture.machinesAvailable")}</p>
              </div>
            ) : filteredAllMachines.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t("capture.noMachinesMatchSearch")} "{addMachineSearch}"</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredAllMachines.map((machine) => (
                  <motion.button
                    key={machine.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => addMachineToLocation(machine)}
                    disabled={isAddingMachine}
                    className="w-full p-3 rounded-lg text-sm text-left transition-all bg-muted/50 border border-transparent hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                  >
                    <span className="font-medium">{machine.name}</span>
                    {(machine.manufacturer || machine.year > 0) && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {machine.manufacturer} {machine.year > 0 && `(${machine.year})`}
                      </span>
                    )}
                  </motion.button>
                ))}
                {filteredAllMachines.length === 50 && (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    {t("capture.showingFirst50")}
                  </p>
                )}
              </div>
            )}
            
            {isAddingMachine && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                <div className="flex flex-col items-center">
                  <Loader2 className="animate-spin text-primary mb-2" size={32} />
                  <p className="text-sm text-muted-foreground">{t("capture.addingToPinballMap")}</p>
                </div>
              </div>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground text-center mt-4">
            {t("capture.addMachineNote")}
          </p>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default Capture;
