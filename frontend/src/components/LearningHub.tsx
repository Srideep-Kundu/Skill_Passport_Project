import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  CheckCircle2,
  Play,
  Video,
  BookOpen,
  GraduationCap,
  Building2,
  Eye,
  Clock,
  Search,
  Filter,
  X,
  FileText,
  Sparkles,
} from "lucide-react";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type { LearningCourse, FacultyVideo } from "../api/types";
import { toast } from "sonner";
import { EditorialButton, EditorialTextTabs } from "./ui/EditorialPrimitives";

interface Props {
  token: string;
  onCourseCompleted?: () => void;
}

export function LearningHub({ token, onCourseCompleted }: Props) {
  // Main view mode
  const [activeHubView, setActiveHubView] = useState<"courses" | "faculty_videos">("faculty_videos");

  // Courses state
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Faculty Videos state
  const [videos, setVideos] = useState<FacultyVideo[]>([]);
  const [facultyNames, setFacultyNames] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [universities, setUniversities] = useState<string[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<string>("All");
  const [selectedUniversity, setSelectedUniversity] = useState<string>("All");
  const [selectedSubject, setSelectedSubject] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [videosLoading, setVideosLoading] = useState(true);

  // Video Player Modal
  const [activePlayingVideo, setActivePlayingVideo] = useState<FacultyVideo | null>(null);

  // Load Courses
  const loadCourses = useCallback(async () => {
    try {
      setCoursesLoading(true);
      const cat = selectedCategory === "All" ? undefined : selectedCategory;
      const data = await api.getCourses(token, cat);
      setCourses(data);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load learning courses"));
    } finally {
      setCoursesLoading(false);
    }
  }, [selectedCategory, token]);

  // Load Faculty Videos
  const loadFacultyVideos = useCallback(async () => {
    try {
      setVideosLoading(true);
      const data = await api.getFacultyVideosCatalog(token, {
        faculty_name: selectedFaculty,
        subject: selectedSubject,
        university: selectedUniversity,
        search: searchQuery || undefined,
      });
      const items = Array.isArray(data?.items) ? data.items : [];
      setVideos(items);
      setFacultyNames(Array.isArray(data?.faculty_names) ? data.faculty_names : []);
      setSubjects(Array.isArray(data?.subjects) ? data.subjects : []);

      // Gather distinct universities from server and item metadata
      const serverUnis = Array.isArray(data?.institutions) ? data.institutions : [];
      const itemUnis = items
        .map((v) => v.faculty_institution)
        .filter((inst): inst is string => Boolean(inst && inst.trim()));
      const combinedUnis = Array.from(new Set([...serverUnis, ...itemUnis])).sort();
      setUniversities(combinedUnis);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load faculty videos"));
    } finally {
      setVideosLoading(false);
    }
  }, [selectedFaculty, selectedSubject, selectedUniversity, searchQuery, token]);

  useEffect(() => {
    if (activeHubView === "courses") {
      void loadCourses();
    } else {
      void loadFacultyVideos();
    }
  }, [activeHubView, loadCourses, loadFacultyVideos]);

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
        toast.success("Course Completed! Certified coursework evidence added to your Lumina Intel.");
        if (onCourseCompleted) onCourseCompleted();
      } else {
        toast.info(`Course progress updated to ${newProgress}%`);
      }
      loadCourses();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update progress"));
    }
  }

  async function handlePlayVideo(video: FacultyVideo) {
    setActivePlayingVideo(video);
    try {
      const res = await api.recordFacultyVideoView(video.id, token);
      // Update local view count
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, views_count: res.views_count } : v))
      );
    } catch {
      // Non-blocking view track
    }
  }

  // Convert regular YouTube URL to embed URL
  function getEmbedVideoUrl(rawUrl: string): string {
    if (!rawUrl) return "";
    try {
      if (rawUrl.includes("youtube.com/watch")) {
        const urlObj = new URL(rawUrl);
        const v = urlObj.searchParams.get("v");
        if (v) return `https://www.youtube.com/embed/${v}?autoplay=1`;
      }
      if (rawUrl.includes("youtu.be/")) {
        const id = rawUrl.split("youtu.be/")[1]?.split("?")[0];
        if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
      }
      if (rawUrl.includes("vimeo.com/")) {
        const id = rawUrl.split("vimeo.com/")[1]?.split("?")[0];
        if (id) return `https://player.vimeo.com/video/${id}?autoplay=1`;
      }
    } catch {
      // fallback
    }
    return rawUrl;
  }

  const hubNavTabs = [
    { id: "faculty_videos", label: "Faculty Video Masterclasses", icon: Video },
    { id: "courses", label: "Curated Courses & Certifications", icon: BookOpen },
  ];

  const categoryTabs = [
    { id: "All", label: "All" },
    { id: "Backend", label: "Backend" },
    { id: "Frontend", label: "Frontend" },
    { id: "AI", label: "AI & ML" },
    { id: "DevOps", label: "DevOps & Cloud" },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Navigation Banner */}
      <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                <Sparkles className="w-3.5 h-3.5" />
                Verified Academic Resources
              </span>
            </div>
            <h2 className="text-2xl font-normal text-[#111827] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Learning Hub & Masterclasses
            </h2>
            <p className="text-sm text-[#64748B] mt-0.5">
              Access curated video lectures directly published by university professors & industry courses to master evidence-backed skills.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#F8FAFC] p-1.5 rounded-md border border-[#E2E8F0]">
            {hubNavTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeHubView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveHubView(tab.id as "courses" | "faculty_videos")}
                  className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#FFFFFF] text-[#0F172A] shadow-xs border border-[#E2E8F0]"
                      : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-[#2563EB]" : "text-[#94A3B8]"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: FACULTY VIDEO MASTERCLASSES WITH FACULTY NAME FILTER
          ========================================================================= */}
      {activeHubView === "faculty_videos" && (
        <div className="space-y-6">
          {/* Filter Bar specifically highlighting Filter by Faculty Name & University */}
          <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-5 rounded-lg shadow-sm space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3.5">
                {/* Filter by Faculty Name Dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-[#1E293B] flex items-center gap-1.5 whitespace-nowrap">
                    <GraduationCap className="h-4 w-4 text-[#2563EB]" />
                    <span>Filter by Faculty:</span>
                  </label>
                  <select
                    value={selectedFaculty}
                    onChange={(e) => setSelectedFaculty(e.target.value)}
                    className="bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] text-sm rounded-md px-3.5 py-2 font-medium focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-hidden cursor-pointer"
                  >
                    <option value="All">All Faculty Members ({facultyNames.length || videos.length})</option>
                    {facultyNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter by University Dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-[#1E293B] flex items-center gap-1.5 whitespace-nowrap">
                    <Building2 className="h-4 w-4 text-[#2563EB]" />
                    <span>University:</span>
                  </label>
                  <select
                    value={selectedUniversity}
                    onChange={(e) => setSelectedUniversity(e.target.value)}
                    className="bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] text-sm rounded-md px-3.5 py-2 font-medium focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-hidden cursor-pointer max-w-[240px]"
                  >
                    <option value="All">All Universities ({universities.length})</option>
                    {universities.map((uni) => (
                      <option key={uni} value={uni}>
                        {uni}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter by Subject Dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-[#1E293B] flex items-center gap-1.5 whitespace-nowrap">
                    <Filter className="h-4 w-4 text-[#64748B]" />
                    <span>Subject:</span>
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] text-sm rounded-md px-3 py-2 font-medium focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-hidden cursor-pointer"
                  >
                    <option value="All">All Subjects</option>
                    {subjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Keyword Search */}
              <div className="relative flex-1 max-w-md min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search topic, skill, or faculty name..."
                  className="w-full pl-10 pr-4 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Active filter pills */}
            {(selectedFaculty !== "All" || selectedUniversity !== "All" || selectedSubject !== "All" || searchQuery) && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F1F5F9] text-xs">
                <span className="text-[#64748B] font-medium">Active Filters:</span>
                {selectedFaculty !== "All" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]">
                    Faculty: {selectedFaculty}
                    <button type="button" onClick={() => setSelectedFaculty("All")} className="hover:text-[#1E3A8A] ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedUniversity !== "All" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                    University: {selectedUniversity}
                    <button type="button" onClick={() => setSelectedUniversity("All")} className="hover:text-[#14532D] ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedSubject !== "All" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F1F5F9] text-[#334155] border border-[#E2E8F0]">
                    Subject: {selectedSubject}
                    <button type="button" onClick={() => setSelectedSubject("All")} className="hover:text-[#0F172A] ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                    Query: "{searchQuery}"
                    <button type="button" onClick={() => setSearchQuery("")} className="hover:text-[#78350F] ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFaculty("All");
                    setSelectedUniversity("All");
                    setSelectedSubject("All");
                    setSearchQuery("");
                  }}
                  className="text-[#2563EB] hover:underline ml-2 font-medium cursor-pointer"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Videos Grid */}
          {videosLoading ? (
            <div className="p-12 text-center border border-[#E5E1D8] bg-[#FFFFFF] rounded-lg">
              <div className="inline-block animate-spin h-7 w-7 border-2 border-[#E5E1D8] border-t-[#2563EB] rounded-full mb-3" />
              <p className="font-mono text-sm text-[#64748B]">Loading faculty masterclasses catalog...</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="p-12 text-center border border-[#E5E1D8] bg-[#FFFFFF] rounded-lg">
              <Video className="h-10 w-10 text-[#94A3B8] mx-auto mb-3" />
              <h3 className="text-lg font-medium text-[#0F172A]">No Faculty Videos Found</h3>
              <p className="text-sm text-[#64748B] mt-1 max-w-md mx-auto">
                No video masterclasses match your current filter criteria. Try resetting the faculty, university, or subject filter.
              </p>
              <EditorialButton
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  setSelectedFaculty("All");
                  setSelectedUniversity("All");
                  setSelectedSubject("All");
                  setSearchQuery("");
                }}
              >
                Reset Filters
              </EditorialButton>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="border border-[#E2E8F0] bg-[#FFFFFF] rounded-lg overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md hover:border-[#CBD5E1] transition-all group"
                >
                  <div>
                    {/* Video Thumbnail with Play Button Overlay */}
                    <div
                      onClick={() => handlePlayVideo(video)}
                      className="relative h-44 bg-[#0F172A] cursor-pointer overflow-hidden group/thumb"
                    >
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300 opacity-85"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-[#1E293B] to-[#0F172A]">
                          <Video className="h-12 w-12 text-[#64748B]" />
                        </div>
                      )}

                      {/* Play Button Icon */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/thumb:bg-black/45 transition-colors">
                        <div className="w-13 h-13 rounded-full bg-[#2563EB] text-white flex items-center justify-center shadow-lg group-hover/thumb:scale-110 transition-transform">
                          <Play className="h-6 w-6 fill-white ml-1" />
                        </div>
                      </div>

                      {/* Duration & Subject Pill */}
                      <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded font-medium">
                        {video.subject}
                      </div>
                      <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-xs text-white text-xs px-2 py-0.5 rounded font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{video.duration_minutes}m</span>
                      </div>
                    </div>

                    {/* Content Body */}
                    <div className="p-5 space-y-3.5">
                      {/* Faculty Info Card */}
                      <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#F1F5F9]">
                        <div className="w-8 h-8 rounded-full bg-[#EFF6FF] text-[#2563EB] font-bold text-xs flex items-center justify-center border border-[#BFDBFE]">
                          {video.faculty_name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-[#0F172A] truncate">
                            {video.faculty_name}
                          </div>
                          <div className="text-[11px] text-[#64748B] truncate">
                            {video.faculty_designation || "Faculty Lead"}
                            {video.faculty_institution ? ` · ${video.faculty_institution}` : ""}
                          </div>
                        </div>
                      </div>

                      {/* Video Title */}
                      <h3
                        onClick={() => handlePlayVideo(video)}
                        className="text-base font-medium text-[#0F172A] leading-snug line-clamp-2 group-hover:text-[#2563EB] transition-colors cursor-pointer"
                      >
                        {video.title}
                      </h3>

                      {/* Description */}
                      <p className="text-xs text-[#475569] leading-relaxed line-clamp-2">
                        {video.description}
                      </p>

                      {/* Skill Tags */}
                      {video.skills_covered && video.skills_covered.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {video.skills_covered.slice(0, 3).map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F1F5F9] text-[#334155] border border-[#E2E8F0]"
                            >
                              {skill}
                            </span>
                          ))}
                          {video.skills_covered.length > 3 && (
                            <span className="px-1.5 py-0.5 text-[10px] text-[#64748B]">
                              +{video.skills_covered.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-5 pt-0">
                    <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                        <Eye className="h-3.5 w-3.5" />
                        <span>{video.views_count} views</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePlayVideo(video)}
                        className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>Watch Lecture</span>
                        <Play className="h-3 w-3 fill-current" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SECTION 2: CURATED COURSES & CERTIFICATIONS (ORIGINAL VIEW)
          ========================================================================= */}
      {activeHubView === "courses" && (
        <div className="space-y-6">
          <EditorialTextTabs
            tabs={categoryTabs}
            activeTab={selectedCategory}
            onChange={setSelectedCategory}
          />

          {coursesLoading ? (
            <div className="p-12 text-center border border-[#E5E1D8] bg-[#FFFFFF] rounded-md">
              <div className="inline-block animate-spin h-6 w-6 border-2 border-[#E5E1D8] border-t-white rounded-full mb-3" />
              <p className="font-mono text-xs text-[#64748B]">Loading recommended coursework catalog...</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="p-12 text-center border border-[#E5E1D8] bg-[#FFFFFF] rounded-md font-mono text-xs text-[#64748B]">
              No courses found for the selected category.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-md flex flex-col justify-between space-y-5 transition-colors hover:border-[#E5E1D8]"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
                      <span>
                        {course.category} / {course.provider}
                      </span>
                      <span className="text-[#B08D57]">★ {course.rating}</span>
                    </div>

                    <h3
                      className="text-xl font-normal text-[#111827] leading-tight"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {course.title}
                    </h3>

                    {course.recommendation_reason && (
                      <p className="text-xs text-[#B08D57] font-mono leading-relaxed">
                        Recommended: {course.recommendation_reason}
                      </p>
                    )}

                    <p className="text-xs text-[#475569] leading-relaxed line-clamp-2">
                      {course.description}
                    </p>

                    <div className="pt-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">
                        Skills Covered
                      </span>
                      <p className="text-xs text-[#475569] font-mono">
                        {course.skills.join(" · ")}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#E5E1D8] space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono text-[#64748B]">
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
                        className="text-[#B08D57] hover:text-[#111827] flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Curriculum</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    {course.is_enrolled ? (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-[#475569]">
                            {course.progress >= 100 ? "Status: Completed" : `Progress: ${course.progress}%`}
                          </span>
                          {course.progress < 100 && (
                            <button
                              type="button"
                              onClick={() => handleUpdateProgress(course.id, 100)}
                              className="text-[#B08D57] hover:text-[#111827] cursor-pointer flex items-center gap-1 transition-colors"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Mark Completed</span>
                            </button>
                          )}
                        </div>
                        <div className="w-full bg-[#F7F5F0] h-1.5 rounded-xs overflow-hidden">
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
      )}

      {/* =========================================================================
          INTERACTIVE VIDEO PLAYER & STUDY NOTES MODAL
          ========================================================================= */}
      {activePlayingVideo && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl max-w-4xl w-full overflow-hidden shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#2563EB] text-white font-semibold text-sm flex items-center justify-center">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A] leading-tight line-clamp-1">
                    {activePlayingVideo.title}
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Lecturer: <span className="font-medium text-[#1E293B]">{activePlayingVideo.faculty_name}</span> · {activePlayingVideo.faculty_designation || activePlayingVideo.faculty_institution}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePlayingVideo(null)}
                className="text-[#64748B] hover:text-[#0F172A] p-1.5 rounded-md hover:bg-[#E2E8F0] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Video Frame */}
            <div className="relative aspect-video w-full bg-[#000000] flex items-center justify-center">
              {activePlayingVideo.video_url.startsWith("/uploads/") || activePlayingVideo.video_url.match(/\.(mp4|webm|ogg|mov|mkv)$/i) ? (
                <video
                  src={activePlayingVideo.video_url.startsWith("/uploads/") ? `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}${activePlayingVideo.video_url}` : activePlayingVideo.video_url}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (
                <iframe
                  src={getEmbedVideoUrl(activePlayingVideo.video_url)}
                  title={activePlayingVideo.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              )}
            </div>

            {/* Video Info & Notes */}
            <div className="p-5 sm:p-6 space-y-4 max-h-[40vh] overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-3 text-xs text-[#64748B]">
                  <span className="inline-flex items-center gap-1 font-medium text-[#1E293B] bg-[#F1F5F9] px-2.5 py-1 rounded">
                    <Clock className="h-3.5 w-3.5 text-[#64748B]" />
                    {activePlayingVideo.duration_minutes} Minutes
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-[#1E293B] bg-[#F1F5F9] px-2.5 py-1 rounded">
                    <Eye className="h-3.5 w-3.5 text-[#64748B]" />
                    {activePlayingVideo.views_count} Views
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-[#2563EB] bg-[#EFF6FF] px-2.5 py-1 rounded border border-[#BFDBFE]">
                    Subject: {activePlayingVideo.subject}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">
                  Lecture Overview
                </h4>
                <p className="text-sm text-[#334155] leading-relaxed">
                  {activePlayingVideo.description}
                </p>
              </div>

              {/* Covered Skills */}
              {activePlayingVideo.skills_covered && activePlayingVideo.skills_covered.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                    Skills Covered
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {activePlayingVideo.skills_covered.map((skill, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded text-xs font-medium bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]"
                      >
                        ✓ {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Study Notes Markdown if provided */}
              {activePlayingVideo.notes_markdown && (
                <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                  <div className="flex items-center gap-2 mb-2 font-medium text-xs text-[#0F172A]">
                    <FileText className="h-4 w-4 text-[#2563EB]" />
                    <span>Professor's Study Notes & Key References</span>
                  </div>
                  <pre className="text-xs text-[#334155] whitespace-pre-wrap font-sans leading-relaxed">
                    {activePlayingVideo.notes_markdown}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
              <EditorialButton
                variant="primary"
                onClick={() => {
                  toast.success("Completed lecture session recorded.");
                  setActivePlayingVideo(null);
                }}
              >
                Close Masterclass
              </EditorialButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
