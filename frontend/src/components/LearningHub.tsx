import { useCallback, useEffect, useState } from "react";
import { ExternalLink, CheckCircle2 } from "lucide-react";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type { LearningCourse } from "../api/types";
import { toast } from "sonner";
import { EditorialButton, EditorialPageHeader, EditorialTextTabs } from "./ui/EditorialPrimitives";

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

  const categoryTabs = [
    { id: "All", label: "All" },
    { id: "Backend", label: "Backend" },
    { id: "Frontend", label: "Frontend" },
    { id: "AI", label: "AI & ML" },
    { id: "DevOps", label: "DevOps & Cloud" },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Editorial Page Header */}
      <EditorialPageHeader
        category="STUDENT"
        index="LEARNING"
        title="Curated Learning Hub"
        subtitle="Targeted coursework mapped directly to close verified skill gaps and meet requirements for high-demand opportunities."
      />

      {/* Clean Category Text Tabs */}
      <EditorialTextTabs
        tabs={categoryTabs}
        activeTab={selectedCategory}
        onChange={setSelectedCategory}
      />

      {/* Courses List as Dark Editorial Records */}
      {loading ? (
        <div className="p-12 text-center border border-white/10 bg-[#071E2B] rounded-md">
          <div className="inline-block animate-spin h-6 w-6 border-2 border-white/20 border-t-white rounded-full mb-3" />
          <p className="font-mono text-xs text-[#8796A2]">Loading recommended coursework catalog...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="p-12 text-center border border-white/10 bg-[#071E2B] rounded-md font-mono text-xs text-[#8796A2]">
          No courses found for the selected category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {courses.map((course) => (
            <div
              key={course.id}
              className="border border-white/10 bg-[#071E2B] p-6 rounded-md flex flex-col justify-between space-y-5 transition-colors hover:border-white/20"
            >
              <div className="space-y-3">
                {/* Category & Provider Eyebrow */}
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[#8796A2]">
                  <span>
                    {course.category} / {course.provider}
                  </span>
                  <span className="text-[#9CC7D8]">★ {course.rating}</span>
                </div>

                {/* Course Title in Instrument Serif */}
                <h3
                  className="text-xl font-normal text-[#F7F8F8] leading-tight"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {course.title}
                </h3>

                {/* Recommendation Reason */}
                {course.recommendation_reason && (
                  <p className="text-xs text-[#9CC7D8] font-mono leading-relaxed">
                    Recommended: {course.recommendation_reason}
                  </p>
                )}

                <p className="text-xs text-[#BEC8CF] leading-relaxed line-clamp-2">
                  {course.description}
                </p>

                {/* Skills as Dot-Separated Text */}
                <div className="pt-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#8796A2] block mb-1">
                    Skills Covered
                  </span>
                  <p className="text-xs text-[#BEC8CF] font-mono">
                    {course.skills.join(" · ")}
                  </p>
                </div>
              </div>

              {/* Course Footer & Actions */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-[#8796A2]">
                  <span>Duration: {course.duration_hours} Hours</span>
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
                    className="text-[#9CC7D8] hover:text-[#F7F8F8] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Curriculum</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {course.is_enrolled ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#BEC8CF]">
                        {course.progress >= 100 ? "Status: Completed" : `Progress: ${course.progress}%`}
                      </span>
                      {course.progress < 100 && (
                        <button
                          type="button"
                          onClick={() => handleUpdateProgress(course.id, 100)}
                          className="text-[#9CC7D8] hover:text-[#F7F8F8] cursor-pointer flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Mark Completed</span>
                        </button>
                      )}
                    </div>
                    <div className="w-full bg-white/5 h-1.5 rounded-xs overflow-hidden">
                      <div
                        className="bg-[#9CC7D8] h-full rounded-xs transition-all duration-300"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <EditorialButton
                    variant="primary"
                    onClick={() => handleEnroll(course.id)}
                    className="w-full justify-center"
                  >
                    Enroll in Course
                  </EditorialButton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
