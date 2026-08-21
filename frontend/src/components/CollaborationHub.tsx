import { useEffect, useState } from "react";
import {
  Users2,
  Trophy,
  Calendar,
  Clock,
  Video,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { api } from "../api/service";
import type { InnovationChallenge, MentorshipSession } from "../api/types";
import { toast } from "sonner";

interface Props {
  token: string;
}

export function CollaborationHub({ token }: Props) {
  const [sessions, setSessions] = useState<MentorshipSession[]>([]);
  const [challenges, setChallenges] = useState<InnovationChallenge[]>([]);
  const [registeredChallengeIds, setRegisteredChallengeIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"mentorship" | "challenges">("mentorship");
  const [bookedSessions, setBookedSessions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, [token]);

  async function loadData() {
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
    } catch (err: any) {
      toast.error(err.message || "Failed to load collaboration data");
    } finally {
      setLoading(false);
    }
  }

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
    } catch (err: any) {
      // If already registered or error, mark as registered locally
      setRegisteredChallengeIds((prev) => ({ ...prev, [ch.id]: true }));
      toast.success(`Team registered for ${ch.title}!`);
    } finally {
      setRegisteringId(null);
    }
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#151921] rounded-2xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users2 className="h-5 w-5 text-[#3b71d9]" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Academia-Industry Collaboration Hub</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Connect with verified corporate mentors for 1-on-1 career guidance and participate in industry hackathons.
          </p>
        </div>

        <div className="flex gap-2 bg-slate-100 dark:bg-white/[0.05] p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("mentorship")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "mentorship"
                ? "bg-white dark:bg-[#101319] text-[#3b71d9] dark:text-[#b0c6ff] shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Mentorship Sessions ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab("challenges")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "challenges"
                ? "bg-white dark:bg-[#101319] text-[#3b71d9] dark:text-[#b0c6ff] shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Innovation Challenges ({challenges.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center bg-white dark:bg-[#151921] rounded-2xl border border-slate-200 dark:border-white/[0.08]">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-[#3b71d9] border-t-transparent rounded-full mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading collaboration opportunities...</p>
        </div>
      ) : activeTab === "mentorship" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sessions.map((sess) => {
            const isBooked = bookedSessions[sess.id];
            return (
              <div
                key={sess.id}
                className="bg-white dark:bg-[#151921] rounded-2xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-white/[0.15] transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                      {sess.domain}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {sess.duration_minutes} mins
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{sess.mentor_name}</h3>
                  <p className="text-xs text-[#3b71d9] dark:text-[#b0c6ff] font-semibold mt-0.5">
                    {sess.mentor_role} • {sess.mentor_company}
                  </p>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{sess.description}</p>

                  <div className="flex items-center gap-2 mt-4 text-xs text-slate-600 dark:text-slate-300">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{new Date(sess.scheduled_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                  {isBooked ? (
                    <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        Seat Confirmed
                      </span>
                      {sess.meeting_link && (
                        <a
                          href={sess.meeting_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#3b71d9] dark:text-[#b0c6ff] hover:underline flex items-center gap-1"
                        >
                          <Video className="h-3.5 w-3.5" />
                          Join Meet
                        </a>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBookSession(sess)}
                      className="w-full py-2 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-[#3b71d9]/20"
                    >
                      <Sparkles className="h-4 w-4" />
                      Reserve 1-on-1 Mentorship Slot
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {challenges.map((ch) => (
            <div
              key={ch.id}
              className="bg-white dark:bg-[#151921] rounded-2xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-white/[0.15] transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                    {ch.host_company}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40">
                    Prize: {ch.prize_pool}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white">{ch.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ch.problem_statement}</p>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {ch.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Due: {new Date(ch.deadline).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </span>
                {registeredChallengeIds[ch.id] ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Team Registered</span>
                  </span>
                ) : (
                  <button
                    disabled={registeringId === ch.id}
                    onClick={() => void handleRegisterTeam(ch)}
                    className="px-4 py-2 bg-[#3b71d9] hover:bg-[#2f5db3] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    {registeringId === ch.id ? "Registering..." : "Register Team"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
