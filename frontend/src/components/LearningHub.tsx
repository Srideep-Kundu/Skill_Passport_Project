import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Star,
  Clock,
  PlayCircle,
} from "lucide-react";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type { LearningCourse } from "../api/types";
import { toast } from "sonner";

interface Props {
  token: string;
  onCourseCompleted?: () => void;
}

export function LearningHub({ token, onCourseCompleted }: Props) {
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const loadCourses = useCallback(async () => {
    try {
      setLoading(true);
      const cat = selectedCategory === "All" ? undefined : selectedCategory;
      const data = await api.getCourses(token, cat);
      setCourses(data);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load learning courses"));
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, token]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  async function handleEnroll(courseId: string) {
    try {
      await api.enrollCourse(courseId, token);
      toast.success("Enrolled in course successfully!");
      loadCourses();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to enroll in course"));
    }
  }

  async function handleUpdateProgress(courseId: string, newProgress: number) {
    try {
      await api.updateCourseProgress(courseId, newProgress, token);
      if (newProgress >= 100) {
        toast.success("Course Completed! Certified coursework evidence added to your Skill Passport.");
        if (onCourseCompleted) onCourseCompleted();
      } else {
        toast.info(`Course progress updated to ${newProgress}%`);
      }
      loadCourses();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update progress"));
    }
  }

  const categories = ["All", "Backend", "Frontend", "AI", "DevOps"];

  return (
    <div className="space-y-6">
      {/* Header & Filter Card */}
      <div className="bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-white/[0.08] shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-5 w-5 text-[#3b71d9] dark:text-[#b0c6ff]" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">Curated Learning Hub</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-[#98a4b3] font-sans">
            Targeted coursework mapped directly to closed skill gaps and high-demand industry roles.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 bg-slate-100/80 dark:bg-white/[0.04] p-1.5 rounded-2xl border border-slate-200/50 dark:border-white/[0.06] backdrop-blur-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-white dark:bg-[#3b71d9]/25 text-[#3b71d9] dark:text-[#b0c6ff] shadow-xs border border-slate-200/60 dark:border-blue-500/40"
                  : "text-slate-600 dark:text-[#98a4b3] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Courses Grid */}
      {loading ? (
        <div className="p-8 text-center bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl rounded-3xl border border-slate-200/70 dark:border-white/[0.08] shadow-lg">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-[#3b71d9] border-t-transparent rounded-full mb-3" />
          <p className="text-sm text-slate-500 dark:text-[#98a4b3] font-sans">Loading recommended learning catalog...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-white/[0.08] shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-white/[0.18] transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-900/30 text-[#3b71d9] dark:text-[#b0c6ff] backdrop-blur-xs">
                    {course.category} • {course.provider}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                    <Star className="h-3.5 w-3.5 fill-amber-500" />
                    <span>{course.rating}</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">{course.title}</h3>
                <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-1 line-clamp-2 font-sans">{course.description}</p>

                {/* Explainable recommendation badge */}
                {course.recommendation_reason && (
                  <div className="mt-2.5 p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 text-[11px] text-[#3b71d9] dark:text-[#b0c6ff] font-medium flex items-start gap-1.5 backdrop-blur-xs font-sans">
                    <span className="shrink-0 font-bold">💡 Why:</span>
                    <span>{course.recommendation_reason}</span>
                  </div>
                )}

                {/* Skills tags */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {course.skills.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100/80 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Course footer / progress */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#98a4b3] font-sans">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {course.duration_hours} hours total
                  </span>
                  <a
                    href={course.url || "#"}
                    target={course.url && course.url !== "#" ? "_blank" : undefined}
                    rel="noreferrer"
                    onClick={(e) => {
                      if (!course.url || course.url === "#" || course.url.startsWith("demo:")) {
                        e.preventDefault();
                        toast.info(`Curriculum Module: ${course.title} — ${course.description}`);
                      }
                    }}
                    className="text-[#3b71d9] dark:text-[#b0c6ff] hover:underline flex items-center gap-1 cursor-pointer font-sans"
                  >
                    <span>Curriculum</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {course.is_enrolled ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-sans">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {course.progress >= 100 ? "Completed" : `In Progress: ${course.progress}%`}
                      </span>
                      {course.progress < 100 && (
                        <button
                          onClick={() => handleUpdateProgress(course.id, 100)}
                          className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 cursor-pointer flex items-center gap-1 font-sans"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark Completed
                        </button>
                      )}
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-white/[0.08] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleEnroll(course.id)}
                    className="w-full py-2 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-[#3b71d9]/20 font-sans"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Enroll in Course
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
