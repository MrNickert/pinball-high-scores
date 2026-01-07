import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Trophy, Camera, MapPin, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";

const features = [
  {
    icon: Trophy,
    title: "Global Leaderboards",
    description: "Compete with pinball wizards worldwide",
    color: "text-primary",
  },
  {
    icon: Camera,
    title: "Photo Capture",
    description: "Snap your high score for verification",
    color: "text-secondary",
  },
  {
    icon: MapPin,
    title: "Location Based",
    description: "Find and track machines near you",
    color: "text-accent",
  },
  {
    icon: Zap,
    title: "Instant Submit",
    description: "Upload scores in seconds",
    color: "text-neon-green",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-0 right-1/4 w-80 h-80 bg-secondary/20 rounded-full blur-[100px]"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.2, 0.4] }}
            transition={{ duration: 5, repeat: Infinity }}
          />
        </div>

        <div className="container mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-block mb-6"
            >
              <span className="font-arcade text-xs text-primary bg-primary/10 px-4 py-2 rounded-full border border-primary/30">
                🏆 HIGH SCORE TRACKER
              </span>
            </motion.div>

            <h1 className="font-arcade text-3xl sm:text-4xl md:text-5xl leading-relaxed mb-6">
              <span className="text-foreground">TRACK YOUR</span>
              <br />
              <span className="arcade-gradient neon-text">PINBALL GLORY</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              Capture, compete, and climb the leaderboards. The ultimate platform 
              for pinball enthusiasts to track their greatest achievements.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button variant="hero" size="xl">
                  Start Playing
                </Button>
              </Link>
              <Link to="/leaderboard">
                <Button variant="neon" size="xl">
                  View Leaderboards
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Score Display Mock */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mt-16 max-w-md mx-auto"
          >
            <div className="glass-card rounded-2xl p-6 neon-border">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">TODAY'S TOP SCORE</p>
                <motion.div
                  className="font-arcade text-4xl text-accent neon-text score-display"
                  animate={{ opacity: [1, 0.8, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  12,847,500
                </motion.div>
                <p className="text-primary mt-2 font-medium">Medieval Madness</p>
                <p className="text-muted-foreground text-sm">by @PinballWizard</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-arcade text-xl text-foreground mb-4">HOW IT WORKS</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Simple steps to immortalize your pinball achievements
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="glass-card rounded-xl p-6 text-center group"
              >
                <motion.div
                  className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-card mb-4 ${feature.color}`}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <feature.icon size={28} />
                </motion.div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card rounded-3xl p-10 md:p-16 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
            <div className="relative z-10">
              <h2 className="font-arcade text-xl md:text-2xl text-foreground mb-4">
                READY TO PLAY?
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto mb-8">
                Join thousands of pinball players tracking their scores and competing globally.
              </p>
              <Link to="/auth">
                <Button variant="hero" size="xl">
                  Create Free Account
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bottom padding for mobile nav */}
      <div className="h-20 md:h-0" />
    </div>
  );
};

export default Index;
