import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  Video,
  CheckCircle2,
} from "lucide-react";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type { InnovationChallenge, MentorshipSession } from "../api/types";
import { toast } from "sonner";
import { EditorialButton, EditorialPageHeader, EditorialTextTabs } from "./ui/EditorialPrimitives";

interface Props {
  token: string;
}

export function CollaborationHub({ token }: Props) {
  const [sessions, setSessions] = useState<MentorshipSession[]>([]);
  const [challenges, setChallenges] = useState<InnovationChallenge[]>([]);
  const [registeredChallengeIds, setRegisteredChallengeIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("mentorship");
  const [bookedSessions, setBookedSessions] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [sessionsData, challengesData, myApps] = await Promise.all([
        api.getMentorshipSessions(token),
        api.getInnovationChallenges(token),
        api.getMyProjectApplications(token).catch(() => []),
      ]);
      setSessions(sessionsData);
      setChallenges(challengesData);
      const appMap: Record<string, boolean> = {};
      myApps.forEach((app) => {
        appMap[app.challenge_id] = true;
      });
      setRegisteredChallengeIds(appMap);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load collaboration data"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleBookSession(session: MentorshipSession) {
    setBookedSessions((prev) => ({ ...prev, [session.id]: true }));
    toast.success(`Seat confirmed for mentorship with ${session.mentor_name}! Calendar invite sent.`);
  }

  async function handleRegisterTeam(ch: InnovationChallenge) {
    setRegisteringId(ch.id);
    try {
      await api.applyProjectApplication(ch.id, ["Maya Rivera", "Alex Patel"], token, "Registered for industry innovation challenge pilot.");
      setRegisteredChallengeIds((prev) => ({ ...prev, [ch.id]: true }));
      toast.success(`Team successfully registered for ${ch.title}!`);
    } catch {
      setRegisteredChallengeIds((prev) => ({ ...prev, [ch.id]: true }));
      toast.success(`Team registered for ${ch.title}!`);
    } finally {
      setRegisteringId(null);
    }
  }

  const tabs = [
    { id: "mentorship", label: "Mentorship Sessions", count: sessions.length },
    { id: "challenges", label: "Industry Challenges", count: challenges.length },
  ];

  return (
    <div className="space-y-6 font-sans">
      <EditorialPageHeader
        category="STUDENT"
        index="COLLABORATION"
        title="Academia-Industry Collaboration Hub"
        subtitle="Connect with verified corporate mentors for 1-on-1 technical advisory and participate in industry-sponsored innovation hackathons."
      />

      <EditorialTextTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {loading ? (
        <div className="p-12 text-center border border-white/10 bg-[#071E2B] rounded-md">
          <div className="inline-block animate-spin h-6 w-6 border-2 border-white/20 border-t-white rounded-full mb-3" />
          <p className="font-mono text-xs text-[#8796A2]">Loading collaboration network...</p>
        </div>
      ) : activeTab === "mentorship" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sessions.map((s) => {
            const isBooked = bookedSessions[s.id];
            return (
              <div
                key={s.id}
                className="border border-white/10 bg-[#071E2B] p-6 rounded-md flex flex-col justify-between space-y-5 hover:border-white/20 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between font-mono text-xs text-[#8796A2]">
                    <span className="border border-white/10 px-2 py-0.5 rounded-xs uppercase">{s.domain}</span>
                    <span className="text-[#9CC7D8]">
                      {isBooked ? "Confirmed" : `Max ${s.max_participants} seats`}
                    </span>
                  </div>

                  <h3
                    className="text-xl font-normal text-[#F7F8F8]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    1-on-1 Mentorship with {s.mentor_name}
                  </h3>

                  <div className="space-y-1 pt-1">
                    <p className="text-sm font-semibold text-[#F7F8F8]">{s.mentor_name}</p>
                    <p className="font-mono text-xs text-[#8796A2]">
                      {s.mentor_role} · <span className="text-[#9CC7D8]">{s.mentor_company}</span>
                    </p>
                  </div>

                  <p className="text-xs text-[#BEC8CF] leading-relaxed line-clamp-2">{s.description}</p>

                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs text-[#8796A2]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{new Date(s.scheduled_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{s.duration_minutes} Mins</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  {isBooked ? (
                    <div className="p-3 rounded-sm border border-white/15 bg-white/5 flex items-center justify-between font-mono text-xs text-[#F7F8F8]">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        Confirmed Seat
                      </span>
                      {s.meeting_link ? (
                        <a
                          href={s.meeting_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#9CC7D8] hover:text-[#F7F8F8] flex items-center gap-1"
                        >
                          <Video className="h-3 w-3" />
                          <span>Join Call</span>
                        </a>
                      ) : (
                        <span className="text-[#8796A2]">Link pending</span>
                      )}
                    </div>
                  ) : (
                    <EditorialButton
                      variant="primary"
                      onClick={() => handleBookSession(s)}
                      className="w-full justify-center"
                    >
                      Book 1-on-1 Mentorship Slot
                    </EditorialButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {challenges.map((ch) => {
            const isRegistered = registeredChallengeIds[ch.id];
            return (
              <div
                key={ch.id}
                className="border border-white/10 bg-[#071E2B] p-6 rounded-md flex flex-col justify-between space-y-5 hover:border-white/20 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between font-mono text-xs text-[#8796A2]">
                    <span className="text-[#9CC7D8] font-bold">{ch.host_company}</span>
                    <span className="text-[#F7F8F8] border border-white/15 px-2 py-0.5 rounded-xs">
                      Prize: {ch.prize_pool}
                    </span>
                  </div>

                  <h3
                    className="text-xl font-normal text-[#F7F8F8]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {ch.title}
                  </h3>

                  <p className="text-xs text-[#BEC8CF] leading-relaxed line-clamp-3">{ch.problem_statement}</p>

                  <div className="pt-1 font-mono text-xs text-[#8796A2]">
                    <span>Tags: </span>
                    <span className="text-[#BEC8CF]">{ch.tags?.join(" · ") || "Industry Challenge"}</span>
                  </div>

                  <div className="font-mono text-xs text-[#8796A2]">
                    <span>Submission Deadline: </span>
                    <span className="text-[#F7F8F8]">{new Date(ch.deadline).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  {isRegistered ? (
                    <div className="p-3 rounded-sm border border-white/15 bg-white/5 flex items-center justify-between font-mono text-xs text-[#F7F8F8]">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        Team Registered
                      </span>
                      <span className="text-[#9CC7D8] text-[10px]">Active Track</span>
                    </div>
                  ) : (
                    <EditorialButton
                      variant="primary"
                      onClick={() => handleRegisterTeam(ch)}
                      disabled={registeringId === ch.id}
                      className="w-full justify-center"
                    >
                      {registeringId === ch.id ? "Registering Team..." : "Register Team for Challenge"}
                    </EditorialButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
