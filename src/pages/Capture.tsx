import { useState } from "react";
import { motion } from "framer-motion";
import { Camera, MapPin, Upload, X, Search, Check } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const mockLocations = [
  { id: 1, name: "Flynn's Arcade", address: "123 Arcade Blvd, Los Angeles, CA", distance: "0.3 mi" },
  { id: 2, name: "Pinball Paradise", address: "456 Game St, Los Angeles, CA", distance: "0.8 mi" },
  { id: 3, name: "Retro Gaming Lounge", address: "789 Vintage Ave, Los Angeles, CA", distance: "1.2 mi" },
];

const mockMachines = [
  "Medieval Madness",
  "The Addams Family",
  "Attack From Mars",
  "Twilight Zone",
  "Theatre of Magic",
  "Monster Bash",
  "Indiana Jones",
];

const Capture = () => {
  const [step, setStep] = useState(1);
  const [selectedLocation, setSelectedLocation] = useState<typeof mockLocations[0] | null>(null);
  const [selectedMachine, setSelectedMachine] = useState("");
  const [scoreImage, setScoreImage] = useState<string | null>(null);
  const [score, setScore] = useState("");
  const { toast } = useToast();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setScoreImage(reader.result as string);
        setStep(3);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    toast({
      title: "Score submitted! 🎯",
      description: "Your score is pending verification.",
    });
    setStep(1);
    setSelectedLocation(null);
    setSelectedMachine("");
    setScoreImage(null);
    setScore("");
  };

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
            <div className="flex items-center gap-2 mb-6">
              <MapPin className="text-secondary" size={20} />
              <h2 className="font-semibold text-foreground">Select Location</h2>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search nearby arcades..."
                className="pl-10"
              />
            </div>

            <div className="space-y-3">
              {mockLocations.map((location) => (
                <motion.button
                  key={location.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    setSelectedLocation(location);
                    setStep(2);
                  }}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    selectedLocation?.id === location.id
                      ? "bg-primary/10 border border-primary"
                      : "bg-muted/50 border border-transparent hover:border-border"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-foreground">{location.name}</p>
                      <p className="text-sm text-muted-foreground">{location.address}</p>
                    </div>
                    <span className="text-xs text-primary font-medium">{location.distance}</span>
                  </div>
                </motion.button>
              ))}
            </div>
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
              onClick={() => setStep(1)}
              className="text-muted-foreground text-sm mb-4 hover:text-foreground transition-colors"
            >
              ← Back to locations
            </button>

            <div className="p-3 bg-muted/50 rounded-lg mb-6">
              <p className="font-medium text-foreground">{selectedLocation?.name}</p>
              <p className="text-sm text-muted-foreground">{selectedLocation?.address}</p>
            </div>

            <div className="mb-6">
              <Label className="text-foreground mb-3 block">Select Machine</Label>
              <div className="grid grid-cols-2 gap-2">
                {mockMachines.map((machine) => (
                  <motion.button
                    key={machine}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedMachine(machine)}
                    className={`p-3 rounded-lg text-sm text-left transition-all ${
                      selectedMachine === machine
                        ? "bg-primary/10 border border-primary text-primary"
                        : "bg-muted/50 border border-transparent text-foreground hover:border-border"
                    }`}
                  >
                    {machine}
                  </motion.button>
                ))}
              </div>
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

            {scoreImage && (
              <div className="relative mb-6">
                <img
                  src={scoreImage}
                  alt="Score"
                  className="w-full h-64 object-cover rounded-xl"
                />
                <button
                  onClick={() => {
                    setScoreImage(null);
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
                <Label className="text-foreground mb-2 block">Enter Your Score</Label>
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
              disabled={!score}
            >
              <Upload size={18} />
              Submit Score
            </Button>
          </motion.div>
        )}
      </div>

      <div className="h-20 md:h-0" />
    </div>
  );
};

export default Capture;
