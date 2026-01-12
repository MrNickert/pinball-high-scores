import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Users, UserPlus, Check, X, Search, UserMinus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createNotification, NotificationTypes } from "@/hooks/useNotifications";
import { useTranslation } from "react-i18next";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  last_location_name?: string | null;
}

interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  profile?: Profile;
}

interface SuggestedUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  location_name: string;
}

const Friends = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingReceived, setPendingReceived] = useState<Friendship[]>([]);
  const [pendingSent, setPendingSent] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  const fetchFriendships = async () => {
    if (!user) return;

    try {
      // Fetch all friendships involving the user
      const { data: friendships, error } = await supabase
        .from("friendships")
        .select("*")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (error) throw error;

      // Get all unique user IDs we need profiles for
      const userIds = new Set<string>();
      friendships?.forEach((f) => {
        if (f.requester_id !== user.id) userIds.add(f.requester_id);
        if (f.addressee_id !== user.id) userIds.add(f.addressee_id);
      });

      // Fetch profiles for these users
      let profiles: Profile[] = [];
      if (userIds.size > 0) {
        const { data: profileData } = await supabase
          .from("public_profiles")
          .select("*")
          .in("user_id", Array.from(userIds));
        profiles = (profileData as Profile[]) || [];
      }

      // Map profiles to friendships
      const friendshipsWithProfiles = friendships?.map((f) => {
        const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        const profile = profiles.find((p) => p.user_id === friendId);
        return { ...f, profile };
      }) || [];

      // Separate by status
      setFriends(friendshipsWithProfiles.filter((f) => f.status === "accepted"));
      setPendingReceived(friendshipsWithProfiles.filter((f) => f.status === "pending" && f.addressee_id === user.id));
      setPendingSent(friendshipsWithProfiles.filter((f) => f.status === "pending" && f.requester_id === user.id));
    } catch (error) {
      console.error("Error fetching friendships:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestedUsers = async () => {
    if (!user) return;
    
    setLoadingSuggestions(true);
    try {
      // First get the current user's locations from their scores
      const { data: userScores } = await supabase
        .from("scores")
        .select("location_name")
        .eq("user_id", user.id)
        .not("location_name", "is", null);

      const userLocations = [...new Set(userScores?.map(s => s.location_name).filter(Boolean) || [])];

      if (userLocations.length === 0) {
        setSuggestedUsers([]);
        setLoadingSuggestions(false);
        return;
      }

      // Find other users who have scores at the same locations
      const { data: otherScores } = await supabase
        .from("scores")
        .select("user_id, location_name")
        .in("location_name", userLocations)
        .neq("user_id", user.id)
        .limit(50);

      if (!otherScores || otherScores.length === 0) {
        setSuggestedUsers([]);
        setLoadingSuggestions(false);
        return;
      }

      // Get unique user IDs
      const uniqueUserIds = [...new Set(otherScores.map(s => s.user_id))];

      // Fetch profiles for these users
      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", uniqueUserIds)
        .limit(10);

      // Map profiles with the location they share
      const suggestions: SuggestedUser[] = (profiles || []).map(profile => {
        const matchingScore = otherScores.find(s => s.user_id === profile.user_id);
        return {
          user_id: profile.user_id!,
          username: profile.username!,
          avatar_url: profile.avatar_url,
          location_name: matchingScore?.location_name || "Same venue",
        };
      });

      setSuggestedUsers(suggestions);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    fetchFriendships();
    fetchSuggestedUsers();
  }, [user]);

  const handleSearch = async () => {
    if (!user) return;

    const q = searchQuery.trim();
    if (q.length < 2) {
      toast.error(t("friends.searchMinChars"));
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-profiles", {
        body: { query: q },
      });

      if (error) {
        // Edge functions surface HTTP errors here
        if ((error as any)?.context?.status === 429) {
          toast.error(t("friends.tooManySearches"));
          return;
        }
        throw error;
      }

      setSearchResults(((data as any)?.profiles as Profile[]) || []);
    } catch (error) {
      console.error("Error searching users:", error);
      toast.error(t("friends.failedToSearch"));
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (addresseeId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("friendships").insert({
        requester_id: user.id,
        addressee_id: addresseeId,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Friend request already exists");
        } else {
          throw error;
        }
      } else {
        // Notification is now handled by database trigger
        toast.success("Friend request sent!");
        setSearchResults((prev) => prev.filter((p) => p.user_id !== addresseeId));
        fetchFriendships();
      }
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast.error("Failed to send friend request");
    }
  };

  const respondToRequest = async (friendshipId: string, accept: boolean) => {
    if (!user) return;

    try {
      if (accept) {
        const { error } = await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("id", friendshipId);
        if (error) throw error;

        // Notification is now handled by database trigger
        toast.success("Friend request accepted!");
      } else {
        const { error } = await supabase
          .from("friendships")
          .delete()
          .eq("id", friendshipId);
        if (error) throw error;
        toast.success("Friend request declined");
      }
      fetchFriendships();
    } catch (error) {
      console.error("Error responding to request:", error);
      toast.error("Failed to respond to request");
    }
  };

  const removeFriend = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId);
      if (error) throw error;
      toast.success("Friend removed");
      fetchFriendships();
    } catch (error) {
      console.error("Error removing friend:", error);
      toast.error("Failed to remove friend");
    }
  };

  const isAlreadyFriendOrPending = (userId: string) => {
    return (
      friends.some((f) => f.profile?.user_id === userId) ||
      pendingSent.some((f) => f.profile?.user_id === userId) ||
      pendingReceived.some((f) => f.profile?.user_id === userId)
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 px-4 text-center">
          <p className="text-muted-foreground">Please sign in to view friends.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-24 px-4">
        <div className="container mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
              <Users className="text-primary" />
              {t("friends.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("friends.subtitle")}
            </p>
          </motion.div>

          {/* Search for users */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <div className="flex gap-2">
              <Input
                placeholder={t("friends.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching}>
                <Search size={18} />
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-4 bg-card rounded-xl border border-border overflow-hidden">
                {searchResults.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-4 border-b border-border last:border-b-0"
                  >
                    <Link to={`/profile/${profile.user_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg overflow-hidden">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          "👤"
                        )}
                      </div>
                      <span className="font-medium text-foreground hover:text-primary transition-colors">{profile.username}</span>
                    </Link>
                    {isAlreadyFriendOrPending(profile.user_id) ? (
                      <span className="text-sm text-muted-foreground">Already connected</span>
                    ) : (
                      <Button size="sm" onClick={() => sendFriendRequest(profile.user_id)}>
                        <UserPlus size={16} />
                        Add
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>


          {/* Tabs for different friend lists */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Tabs defaultValue="friends">
              <TabsList className="w-full mb-4 grid grid-cols-4">
                <TabsTrigger value="friends">
                  {t("friends.title")} ({friends.length})
                </TabsTrigger>
                <TabsTrigger value="nearby">
                  <MapPin size={14} className="mr-1" />
                  {t("friends.nearby")}
                </TabsTrigger>
                <TabsTrigger value="requests">
                  {t("friends.requests")} ({pendingReceived.length})
                </TabsTrigger>
                <TabsTrigger value="sent">
                  {t("friends.sent")} ({pendingSent.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="friends">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
                ) : friends.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("friends.noFriendsYet")}
                  </div>
                ) : (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    {friends.map((friendship) => (
                      <div
                        key={friendship.id}
                        className="flex items-center justify-between p-4 border-b border-border last:border-b-0"
                      >
                        <Link to={`/profile/${friendship.profile?.user_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg">
                            {friendship.profile?.avatar_url ? (
                              <img src={friendship.profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              "👤"
                            )}
                          </div>
                          <span className="font-medium text-foreground hover:text-primary transition-colors">{friendship.profile?.username || "Unknown"}</span>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => removeFriend(friendship.id)}>
                          <UserMinus size={16} className="text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="nearby">
                {loadingSuggestions ? (
                  <div className="text-center py-8 text-muted-foreground">{t("friends.loadingNearby")}</div>
                ) : suggestedUsers.filter(u => !isAlreadyFriendOrPending(u.user_id)).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="mx-auto mb-3 text-muted-foreground" size={32} />
                    <p className="mb-2">{t("friends.noPlayersNearby")}</p>
                    <p className="text-sm">{t("friends.playMoreLocations")}</p>
                  </div>
                ) : (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    {suggestedUsers
                      .filter(u => !isAlreadyFriendOrPending(u.user_id))
                      .map((profile) => (
                        <div
                          key={profile.user_id}
                          className="flex items-center justify-between p-4 border-b border-border last:border-b-0"
                        >
                          <Link to={`/profile/${profile.user_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg overflow-hidden">
                              {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                "👤"
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-foreground block hover:text-primary transition-colors">{profile.username}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin size={10} />
                                {profile.location_name}
                              </span>
                            </div>
                          </Link>
                          <Button size="sm" onClick={() => sendFriendRequest(profile.user_id)}>
                            <UserPlus size={16} />
                            Add
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="requests">
                {pendingReceived.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending friend requests
                  </div>
                ) : (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    {pendingReceived.map((friendship) => (
                      <div
                        key={friendship.id}
                        className="flex items-center justify-between p-4 border-b border-border last:border-b-0"
                      >
                        <Link to={`/profile/${friendship.profile?.user_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg">
                            {friendship.profile?.avatar_url ? (
                              <img src={friendship.profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              "👤"
                            )}
                          </div>
                          <span className="font-medium text-foreground hover:text-primary transition-colors">{friendship.profile?.username || "Unknown"}</span>
                        </Link>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => respondToRequest(friendship.id, true)}>
                            <Check size={16} />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => respondToRequest(friendship.id, false)}>
                            <X size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sent">
                {pendingSent.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending sent requests
                  </div>
                ) : (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    {pendingSent.map((friendship) => (
                      <div
                        key={friendship.id}
                        className="flex items-center justify-between p-4 border-b border-border last:border-b-0"
                      >
                        <Link to={`/profile/${friendship.profile?.user_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg">
                            {friendship.profile?.avatar_url ? (
                              <img src={friendship.profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              "👤"
                            )}
                          </div>
                          <span className="font-medium text-foreground hover:text-primary transition-colors">{friendship.profile?.username || "Unknown"}</span>
                        </Link>
                        <span className="text-sm text-muted-foreground">Pending</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
      <div className="h-20 md:h-0" />
    </div>
  );
};

export default Friends;
