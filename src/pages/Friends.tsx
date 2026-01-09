import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Users, UserPlus, Check, X, Search, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createNotification, NotificationTypes } from "@/hooks/useNotifications";

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
    if (!searchQuery.trim() || !user) return;

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("public_profiles")
        .select("*")
        .ilike("username", `%${searchQuery}%`)
        .neq("user_id", user.id)
        .limit(10);

      if (error) throw error;
      setSearchResults((data as Profile[]) || []);
    } catch (error) {
      console.error("Error searching users:", error);
      toast.error("Failed to search users");
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (addresseeId: string) => {
    if (!user) return;

    try {
      // Get sender's username for the notification
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle();

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
        // Create notification for the addressee
        await createNotification({
          userId: addresseeId,
          type: NotificationTypes.FRIEND_REQUEST,
          title: "New Friend Request",
          message: `${senderProfile?.username || "Someone"} sent you a friend request`,
          data: { requesterId: user.id },
        });

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
      // Find the friendship to get requester info
      const friendship = pendingReceived.find((f) => f.id === friendshipId);

      if (accept) {
        const { error } = await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("id", friendshipId);
        if (error) throw error;

        // Get accepter's username for the notification
        const { data: accepterProfile } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", user.id)
          .maybeSingle();

        // Notify the requester that their request was accepted
        if (friendship) {
          await createNotification({
            userId: friendship.requester_id,
            type: NotificationTypes.FRIEND_ACCEPTED,
            title: "Friend Request Accepted",
            message: `${accepterProfile?.username || "Someone"} accepted your friend request`,
            data: { friendId: user.id },
          });
        }

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
              Friends
            </h1>
            <p className="text-muted-foreground">
              Connect with other players and see their activity
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
                placeholder="Search by username..."
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

          {/* Suggested users from same locations */}
          {suggestedUsers.filter(u => !isAlreadyFriendOrPending(u.user_id)).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-6"
            >
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span>🎯</span> Players at your venues
              </h2>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                {suggestedUsers
                  .filter(u => !isAlreadyFriendOrPending(u.user_id))
                  .slice(0, 5)
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
                          <span className="text-xs text-muted-foreground">{profile.location_name}</span>
                        </div>
                      </Link>
                      <Button size="sm" onClick={() => sendFriendRequest(profile.user_id)}>
                        <UserPlus size={16} />
                        Add
                      </Button>
                    </div>
                  ))}
              </div>
            </motion.div>
          )}

          {/* Tabs for different friend lists */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Tabs defaultValue="friends">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="friends" className="flex-1">
                  Friends ({friends.length})
                </TabsTrigger>
                <TabsTrigger value="requests" className="flex-1">
                  Requests ({pendingReceived.length})
                </TabsTrigger>
                <TabsTrigger value="sent" className="flex-1">
                  Sent ({pendingSent.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="friends">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : friends.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No friends yet. Search for users to connect!
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
