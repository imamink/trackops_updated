import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Home,
  LogOut,
  Menu,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db, firebaseConfigReady } from "../firebase";
import { useAuth } from "../context/AuthContext";

const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const defaultTaskForm = {
  id: null,
  title: "",
  assignedTo: "",
  day: "Monday",
  priority: "High",
  notes: "",
  reminder: "8:00 AM",
  repeating: false,
};
const defaultAnnouncementForm = {
  id: null,
  title: "",
  body: "",
};
const defaultInquiryForm = {
  id: null,
  guestName: "",
  phone: "",
  email: "",
  inquiryFor: "",
};
const defaultTeamForm = {
  id: null,
  name: "",
  role: "Team Member",
};

function normalizeStorageKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function getStorageKey(siteLabel, section) {
  return `trackops:${normalizeStorageKey(siteLabel)}:${section}`;
}

function loadStoredJson(siteLabel, section, fallback) {
  try {
    const stored = window.localStorage.getItem(getStorageKey(siteLabel, section));
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveStoredJson(siteLabel, section, value) {
  window.localStorage.setItem(getStorageKey(siteLabel, section), JSON.stringify(value));
}

function hasStoredJson(siteLabel, section) {
  try {
    return window.localStorage.getItem(getStorageKey(siteLabel, section)) !== null;
  } catch {
    return false;
  }
}

function buildDefaultDashboardState(siteLabel, accountName) {
  return {
    tasks: buildWeeklyTasks(siteLabel),
    inquiries: buildInitialInquiries(),
    announcements: buildInitialAnnouncements(siteLabel),
    team: buildInitialTeam(siteLabel, accountName),
    activityLog: [],
  };
}

function loadLocalDashboardState(siteLabel, accountName) {
  const defaults = buildDefaultDashboardState(siteLabel, accountName);

  return {
    tasks: loadStoredJson(siteLabel, "tasks", defaults.tasks),
    inquiries: loadStoredJson(siteLabel, "inquiries", defaults.inquiries),
    announcements: loadStoredJson(siteLabel, "announcements", defaults.announcements),
    team: loadStoredJson(siteLabel, "team", defaults.team),
    activityLog: loadStoredJson(siteLabel, "activity-log", defaults.activityLog),
  };
}

function hasAnyLocalDashboardState(siteLabel) {
  return ["tasks", "inquiries", "announcements", "team", "activity-log"].some((section) =>
    hasStoredJson(siteLabel, section)
  );
}

function normalizeDashboardState(rawState, siteLabel, accountName) {
  const defaults = buildDefaultDashboardState(siteLabel, accountName);

  if (!rawState || typeof rawState !== "object") {
    return defaults;
  }

  return {
    tasks: Array.isArray(rawState.tasks) ? rawState.tasks : defaults.tasks,
    inquiries: Array.isArray(rawState.inquiries) ? rawState.inquiries : defaults.inquiries,
    announcements: Array.isArray(rawState.announcements) ? rawState.announcements : defaults.announcements,
    team: Array.isArray(rawState.team) ? rawState.team : defaults.team,
    activityLog: Array.isArray(rawState.activityLog) ? rawState.activityLog : defaults.activityLog,
  };
}

function getTodayStamp() {
  return new Date().toLocaleDateString("en-US");
}

function getTimestampLabel() {
  return new Date().toLocaleString();
}

function promptForInitials(itemLabel) {
  const initials = window.prompt(`Enter your initials to close this ${itemLabel}.`);
  return initials ? initials.trim().toUpperCase().slice(0, 4) : "";
}

function formatPhoneNumber(value) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return value.trim();
}

function getWeekStart(weekOffset = 0) {
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(today.getDate() - today.getDay() + weekOffset * 7);
  return start;
}

function formatWeekRange(weekOffset = 0) {
  const start = getWeekStart(weekOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

function getCurrentDayName() {
  return weekDays[new Date().getDay()];
}

function buildWeeklyTasks(siteLabel) {
  return [
    {
      id: "task-1",
      title: "Open the current week checklist",
      assignedTo: `${siteLabel} Leadership`,
      day: "Monday",
      type: "weekly",
      repeating: true,
      weekOffset: 0,
      status: "Open",
      priority: "High",
      notes: "Review the leadership checklist and confirm the site plan for the week.",
      assignedBy: "TrackOps",
      reminder: "8:00 AM",
      completedAt: "",
      completedBy: "",
      comments: [
        {
          id: "comment-1",
          author: "TrackOps",
          message: "Start here each Monday so the week stays organized.",
          createdAt: "Today",
        },
      ],
    },
    {
      id: "task-2",
      title: "Verify supplies and detergent shipment status",
      assignedTo: `${siteLabel} Leadership`,
      day: "Wednesday",
      type: "daily",
      repeating: false,
      weekOffset: 0,
      status: "Open",
      priority: "Low",
      notes: "Confirm on-hand inventory and flag any detergent shipment issue early.",
      assignedBy: "TrackOps",
      reminder: "1:00 PM",
      completedAt: "",
      completedBy: "",
      comments: [],
    },
    {
      id: "task-3",
      title: "Close completed tickets before shift end",
      assignedTo: `${siteLabel} Leadership`,
      day: "Friday",
      type: "weekly",
      repeating: true,
      weekOffset: 0,
      status: "Open",
      priority: "High",
      notes: "Make sure open work is updated and closed items include clear notes.",
      assignedBy: "TrackOps",
      reminder: "5:30 PM",
      completedAt: "",
      completedBy: "",
      comments: [],
    },
  ];
}

function buildInitialInquiries() {
  return [
    {
      id: "inquiry-1",
      guestName: "Maria Thompson",
      phone: "(555) 203-1187",
      email: "maria.thompson@example.com",
      inquiryFor: "Asked about a move-in special and weekend tour availability.",
      status: "Open",
      createdBy: "TrackOps",
      createdAt: "Today",
      closedAt: "",
      comments: [
        {
          id: "inquiry-comment-1",
          author: "TrackOps",
          message: "Needs a follow-up call after 2 PM.",
          createdAt: "Today",
        },
      ],
    },
  ];
}

function buildInitialAnnouncements(siteLabel) {
  return [
    {
      id: "announcement-1",
      title: "Weekly Leadership Announcement",
      body: `Welcome back to ${siteLabel}. Review open tasks, update the schedule, and close completed work before the end of each shift.`,
      author: "TrackOps",
      weekRange: formatWeekRange(0),
      createdAt: new Date().toLocaleString(),
    },
  ];
}

function buildInitialTeam(siteLabel, accountName) {
  return [
    { id: "team-lead", name: accountName, role: "Site Lead" },
    { id: "team-assistant", name: `${siteLabel} Assistant`, role: "Assistant Site Leader" },
    { id: "team-member-1", name: `${siteLabel} Team Member 1`, role: "Team Member" },
  ];
}

export default function SiteDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  const storageSiteKey = profile?.siteIds?.[0] || profile?.siteName || profile?.name || "Your Site";
  const siteLabel = profile?.siteName || profile?.name || storageSiteKey;
  const accountName = profile?.name || profile?.siteName || siteLabel;
  const currentDay = getCurrentDayName();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState(() => buildWeeklyTasks(siteLabel));
  const [commentDrafts, setCommentDrafts] = useState({});
  const [activityLog, setActivityLog] = useState([]);
  const [taskForm, setTaskForm] = useState(() => ({
    ...defaultTaskForm,
    day: currentDay,
    assignedTo: `${siteLabel} Leadership`,
  }));
  const [inquiries, setInquiries] = useState(() => buildInitialInquiries());
  const [inquiryForm, setInquiryForm] = useState(defaultInquiryForm);
  const [inquiryCommentDrafts, setInquiryCommentDrafts] = useState({});
  const [announcementForm, setAnnouncementForm] = useState(defaultAnnouncementForm);
  const [announcements, setAnnouncements] = useState(() => buildInitialAnnouncements(siteLabel));
  const [announcementAction, setAnnouncementAction] = useState("");
  const [teamForm, setTeamForm] = useState(defaultTeamForm);
  const [team, setTeam] = useState(() => buildInitialTeam(siteLabel, accountName));
  const [selectedDay, setSelectedDay] = useState(currentDay);
  const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);
  const [hasHydrated, setHasHydrated] = useState(false);

  const pageView = searchParams.get("view") || "dashboard";
  const editTaskId = searchParams.get("taskId");
  const historyCounts = useMemo(() => {
    const counts = new Map();
    activityLog.forEach((entry) => {
      counts.set(entry.initials, (counts.get(entry.initials) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([initials, total]) => ({ initials, total }));
  }, [activityLog]);
  const todayClosedCounts = useMemo(() => {
    const counts = new Map();
    const today = getTodayStamp();
    activityLog.forEach((entry) => {
      if (entry.closedDate !== today) return;
      counts.set(entry.initials, (counts.get(entry.initials) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([initials, total]) => ({ initials, total }));
  }, [activityLog]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateDashboard() {
      setHasHydrated(false);

      const localState = loadLocalDashboardState(storageSiteKey, accountName);
      const applyState = (nextState) => {
        if (cancelled) return;
        setTasks(nextState.tasks);
        setInquiries(nextState.inquiries);
        setAnnouncements(nextState.announcements);
        setTeam(nextState.team);
        setActivityLog(nextState.activityLog);
        setHasHydrated(true);
      };

      if (!firebaseConfigReady || !db || !profile?.uid) {
        applyState(localState);
        return;
      }

      try {
        const userRef = doc(db, "users", profile.uid);
        const [userSnap, siteSnap] = await Promise.all([
          getDoc(userRef),
          getDoc(doc(db, "sites", storageSiteKey)),
        ]);

        const remoteState = userSnap.exists()
          ? normalizeDashboardState(userSnap.data().dashboardState, siteLabel, accountName)
          : null;

        if (remoteState) {
          applyState(remoteState);
          return;
        }

        const legacySiteState = siteSnap.exists()
          ? normalizeDashboardState(siteSnap.data().dashboardState, siteLabel, accountName)
          : null;

        if (legacySiteState) {
          applyState(legacySiteState);
          return;
        }

        if (hasAnyLocalDashboardState(storageSiteKey)) {
          applyState(localState);
          return;
        }

        applyState(buildDefaultDashboardState(siteLabel, accountName));
      } catch {
        applyState(localState);
      }
    }

    hydrateDashboard();

    return () => {
      cancelled = true;
    };
  }, [accountName, profile?.uid, siteLabel, storageSiteKey]);

  useEffect(() => {
    if (!hasHydrated) return;
    saveStoredJson(storageSiteKey, "tasks", tasks);
  }, [hasHydrated, storageSiteKey, tasks]);

  useEffect(() => {
    if (!hasHydrated) return;
    saveStoredJson(storageSiteKey, "inquiries", inquiries);
  }, [hasHydrated, inquiries, storageSiteKey]);

  useEffect(() => {
    if (!hasHydrated) return;
    saveStoredJson(storageSiteKey, "announcements", announcements);
  }, [announcements, hasHydrated, storageSiteKey]);

  useEffect(() => {
    if (announcements.length === 0 && announcementAction) {
      setAnnouncementAction("");
    }
  }, [announcementAction, announcements]);

  useEffect(() => {
    if (!hasHydrated) return;
    saveStoredJson(storageSiteKey, "team", team);
  }, [hasHydrated, storageSiteKey, team]);

  useEffect(() => {
    if (!hasHydrated) return;
    saveStoredJson(storageSiteKey, "activity-log", activityLog);
  }, [activityLog, hasHydrated, storageSiteKey]);

  useEffect(() => {
    if (!hasHydrated || !firebaseConfigReady || !db || !profile?.uid) return;

    setDoc(
      doc(db, "users", profile.uid),
      {
        dashboardState: {
          tasks,
          inquiries,
          announcements,
          team,
          activityLog,
        },
        dashboardUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((error) => {
      console.error("Unable to sync dashboard state to Firestore.", error);
    });
  }, [
    activityLog,
    announcements,
    hasHydrated,
    inquiries,
    profile?.uid,
    siteLabel,
    storageSiteKey,
    tasks,
    team,
  ]);

  const filteredTasks = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tasks;

    return tasks.filter((task) => {
      const commentText = task.comments.map((comment) => `${comment.author} ${comment.message}`).join(" ");
      return `${task.title} ${task.assignedTo} ${task.day} ${task.notes} ${commentText}`.toLowerCase().includes(term);
    });
  }, [query, tasks]);

  const openTasks = filteredTasks.filter((task) => task.status === "Open");
  const completedTasks = filteredTasks.filter((task) => task.status === "Done");
  const weeklyTasks = filteredTasks.filter((task) => task.repeating);
  const dailyTasksForCurrentWeek = filteredTasks.filter(
    (task) => !task.repeating && (task.weekOffset ?? 0) === 0
  );
  const dailyTasks = dailyTasksForCurrentWeek.filter((task) => task.day === selectedDay);
  const visibleCalendarTasks = filteredTasks.filter(
    (task) => task.repeating || (task.weekOffset ?? 0) === calendarWeekOffset
  );
  const visibleCalendarTasksByDay = weekDays.reduce((acc, day) => {
    acc[day] = visibleCalendarTasks.filter((task) => task.day === day);
    return acc;
  }, {});
  const inquiryGroups = useMemo(() => {
    const groups = new Map();
    inquiries.forEach((inquiry) => {
      const key = inquiry.guestName.trim() || "Unknown Guest";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(inquiry);
    });
    return Array.from(groups.entries());
  }, [inquiries]);
  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "tasks", label: "Tasks", icon: ClipboardList },
    { id: "inquiries", label: "Guest Inquiries", icon: MessageSquareText },
    { id: "team", label: "Team", icon: Users },
  ];

  function goToDashboard() {
    setSearchParams({});
  }

  function goToTaskForm(task = null) {
    if (task) {
      setTaskForm({
        id: task.id,
        title: task.title,
        assignedTo: task.assignedTo,
        day: task.day,
        priority: task.priority,
        notes: task.notes,
        reminder: task.reminder,
        repeating: Boolean(task.repeating),
      });
      setSearchParams({ view: "edit-task", taskId: task.id });
      return;
    }

    setTaskForm({
      ...defaultTaskForm,
      day: selectedDay || currentDay,
      assignedTo: `${siteLabel} Leadership`,
      repeating: false,
    });
    setSearchParams({ view: "new-task" });
  }

  function goToAnnouncementForm(announcement = null) {
    if (announcement) {
      setAnnouncementForm({
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
      });
      setSearchParams({ view: "edit-announcement", announcementId: announcement.id });
      return;
    }

    setAnnouncementForm(defaultAnnouncementForm);
    setSearchParams({ view: "new-announcement" });
  }

  function goToTeamForm(member = null) {
    if (member) {
      setTeamForm(member);
      setSearchParams({ view: "edit-team-member", memberId: member.id });
      return;
    }

    setTeamForm(defaultTeamForm);
    setSearchParams({ view: "team-settings" });
  }

  function goToInquiryForm(inquiry = null) {
    if (inquiry) {
      setInquiryForm({
        id: inquiry.id,
        guestName: inquiry.guestName,
        phone: inquiry.phone,
        email: inquiry.email,
        inquiryFor: inquiry.inquiryFor,
      });
      setSearchParams({ view: "edit-inquiry", inquiryId: inquiry.id });
      return;
    }

    setInquiryForm(defaultInquiryForm);
    setSearchParams({ view: "new-inquiry" });
  }

  function handleToggleTask(taskId) {
    const targetTask = tasks.find((task) => task.id === taskId);
    if (!targetTask) return;

    if (targetTask.status === "Open") {
      const initials = promptForInitials("task");
      if (!initials) return;

      const closedAt = getTimestampLabel();
      const closedDate = getTodayStamp();

      setActivityLog((entries) => [
        {
          id: `activity-${Date.now()}`,
          sourceId: taskId,
          sourceType: "task",
          title: targetTask.title,
          initials,
          closedAt,
          closedDate,
        },
        ...entries,
      ]);

      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: "Done",
                completedAt: closedAt,
                completedBy: initials,
              }
            : task
        )
      );
      return;
    }

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: "Open",
              completedAt: "",
              completedBy: "",
            }
          : task
      )
    );
  }

  function handleDeleteTask(taskId) {
    setTasks((current) => current.filter((task) => task.id !== taskId));
    setCommentDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[taskId];
      return nextDrafts;
    });
    if (editTaskId === taskId) {
      goToDashboard();
    }
  }

  function handleAddComment(taskId) {
    const nextComment = (commentDrafts[taskId] || "").trim();
    if (!nextComment) return;

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              comments: [
                ...task.comments,
                {
                  id: `${taskId}-${Date.now()}`,
                  author: accountName,
                  message: nextComment,
                  createdAt: new Date().toLocaleString(),
                },
              ],
            }
          : task
      )
    );

    setCommentDrafts((current) => ({ ...current, [taskId]: "" }));
  }

  function handleTaskSubmit(e) {
    e.preventDefault();

    const title = taskForm.title.trim();
    const assignedTo = taskForm.assignedTo.trim();
    const notes = taskForm.notes.trim();

    if (!title || !assignedTo) return;

    if (taskForm.id) {
      setTasks((current) =>
        current.map((task) =>
          task.id === taskForm.id
            ? {
                ...task,
                title,
                assignedTo,
                day: taskForm.day,
                priority: taskForm.priority,
                notes,
                reminder: taskForm.reminder,
                repeating: Boolean(taskForm.repeating),
                type: taskForm.repeating ? "weekly" : "daily",
                weekOffset: taskForm.repeating ? 0 : 0,
              }
            : task
        )
      );
    } else {
      setTasks((current) => [
        {
          id: `task-${Date.now()}`,
          title,
          assignedTo,
          day: taskForm.day,
          type: taskForm.repeating ? "weekly" : "daily",
          repeating: Boolean(taskForm.repeating),
          weekOffset: 0,
          status: "Open",
          priority: taskForm.priority,
          notes,
          assignedBy: accountName,
          reminder: taskForm.reminder,
          completedAt: "",
          completedBy: "",
          comments: [],
        },
        ...current,
      ]);
    }

    goToDashboard();
  }

  function handleAnnouncementSubmit(e) {
    e.preventDefault();
    const title = announcementForm.title.trim();
    const body = announcementForm.body.trim();
    if (!title || !body) return;

    if (announcementForm.id) {
      setAnnouncements((current) =>
        current.map((announcement) =>
          announcement.id === announcementForm.id
            ? {
                ...announcement,
                title,
                body,
                author: accountName,
                weekRange: formatWeekRange(calendarWeekOffset),
              }
            : announcement
        )
      );
    } else {
      setAnnouncements((current) => [
        {
          id: `announcement-${Date.now()}`,
          title,
          body,
          author: accountName,
          weekRange: formatWeekRange(calendarWeekOffset),
          createdAt: new Date().toLocaleString(),
        },
        ...current,
      ]);
    }
    goToDashboard();
  }

  function handleDeleteAnnouncement(announcementId) {
    setAnnouncements((current) => current.filter((announcement) => announcement.id !== announcementId));
    setAnnouncementAction("");
    if (announcementForm.id === announcementId) {
      goToDashboard();
    }
  }

  function handleAnnouncementActionClick(announcement) {
    if (announcementAction === "edit") {
      goToAnnouncementForm(announcement);
      setAnnouncementAction("");
      return;
    }

    if (announcementAction === "delete") {
      handleDeleteAnnouncement(announcement.id);
    }
  }

  function handleTeamSubmit(e) {
    e.preventDefault();
    const name = teamForm.name.trim();
    const role = teamForm.role.trim();
    if (!name || !role) return;

    if (teamForm.id) {
      setTeam((current) =>
        current.map((member) => (member.id === teamForm.id ? { ...member, name, role } : member))
      );
    } else {
      setTeam((current) => [{ id: `team-${Date.now()}`, name, role }, ...current]);
    }

    setSearchParams({ view: "team-settings" });
    setTeamForm(defaultTeamForm);
  }

  function handleDeleteTeamMember(memberId) {
    setTeam((current) => current.filter((member) => member.id !== memberId));
    if (teamForm.id === memberId) {
      setTeamForm(defaultTeamForm);
      setSearchParams({ view: "team-settings" });
    }
  }

  function handleInquirySubmit(e) {
    e.preventDefault();

    const guestName = inquiryForm.guestName.trim();
    const phone = formatPhoneNumber(inquiryForm.phone);
    const email = inquiryForm.email.trim();
    const inquiryFor = inquiryForm.inquiryFor.trim();

    if (!guestName || !phone || !inquiryFor) return;

    if (inquiryForm.id) {
      setInquiries((current) =>
        current.map((inquiry) =>
          inquiry.id === inquiryForm.id
            ? {
                ...inquiry,
                guestName,
                phone,
                email,
                inquiryFor,
              }
            : inquiry
        )
      );
    } else {
      setInquiries((current) => [
        {
          id: `inquiry-${Date.now()}`,
          guestName,
          phone,
          email,
          inquiryFor,
          status: "Open",
          createdBy: accountName,
          createdAt: new Date().toLocaleString(),
          closedAt: "",
          comments: [],
        },
        ...current,
      ]);
    }

    goToDashboard();
  }

  function handleCloseInquiry(inquiryId) {
    const targetInquiry = inquiries.find((inquiry) => inquiry.id === inquiryId);
    if (!targetInquiry) return;

    const initials = promptForInitials("guest inquiry");
    if (!initials) return;

    const closedAt = getTimestampLabel();
    const closedDate = getTodayStamp();

    setActivityLog((entries) => [
      {
        id: `activity-${Date.now()}`,
        sourceId: inquiryId,
        sourceType: "inquiry",
        title: targetInquiry.guestName,
        initials,
        closedAt,
        closedDate,
      },
      ...entries,
    ]);

    setInquiries((current) => current.filter((inquiry) => inquiry.id !== inquiryId));
  }

  function handleAddInquiryComment(inquiryId) {
    const nextComment = (inquiryCommentDrafts[inquiryId] || "").trim();
    if (!nextComment) return;

    setInquiries((current) =>
      current.map((inquiry) =>
        inquiry.id === inquiryId
          ? {
              ...inquiry,
              comments: [
                ...inquiry.comments,
                {
                  id: `${inquiryId}-${Date.now()}`,
                  author: accountName,
                  message: nextComment,
                  createdAt: new Date().toLocaleString(),
                },
              ],
            }
          : inquiry
      )
    );

    setInquiryCommentDrafts((current) => ({ ...current, [inquiryId]: "" }));
  }

  function renderHome() {
    return (
      <>
        <section className="announcement-box">
          <div>
            <span>
              <Bell size={14} /> Announcement
            </span>
            {announcements.length === 0 && <p>No announcements posted yet.</p>}
            <div className="announcement-list">
              {announcements.map((announcement) => (
                <article
                  className={`announcement-item ${announcementAction ? "selectable" : ""}`}
                  key={announcement.id}
                  onClick={() => handleAnnouncementActionClick(announcement)}
                  role={announcementAction ? "button" : undefined}
                  tabIndex={announcementAction ? 0 : undefined}
                  onKeyDown={
                    announcementAction
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleAnnouncementActionClick(announcement);
                          }
                        }
                      : undefined
                  }
                >
                  <h1>{announcement.title}</h1>
                  <p>{announcement.body}</p>
                  <small>
                    {announcement.author} • {announcement.weekRange}
                  </small>
                </article>
              ))}
            </div>
            {announcements.length > 0 && (
              <div className="announcement-controls">
                <div className="announcement-actions">
                  <button
                    type="button"
                    aria-label="Choose announcement to edit"
                    className={announcementAction === "edit" ? "active" : ""}
                    onClick={() => setAnnouncementAction((current) => (current === "edit" ? "" : "edit"))}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className={`danger ${announcementAction === "delete" ? "active" : ""}`}
                    type="button"
                    aria-label="Choose announcement to delete"
                    onClick={() => setAnnouncementAction((current) => (current === "delete" ? "" : "delete"))}
                  >
                    <Trash2 size={14} />
                  </button>
                  {announcementAction && (
                    <button
                      className="announcement-cancel-btn"
                      type="button"
                      aria-label="Cancel announcement action"
                      onClick={() => setAnnouncementAction("")}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {announcementAction && (
                  <span className="announcement-helper">
                    {announcementAction === "edit"
                      ? "Click an announcement to edit it."
                      : "Click an announcement to delete it."}
                  </span>
                )}
              </div>
            )}
          </div>
          <button className="announcement-btn" type="button" onClick={goToAnnouncementForm}>
            + Add Announcement
          </button>
        </section>

        <section className="stats-grid">
          <Stat label="Open Tasks" value={openTasks.length} />
          <Stat label="Completed" value={completedTasks.length} />
          <Stat label="Assigned Site" value={siteLabel} compact />
          <Stat label="Access" value="Full" compact />
        </section>

        <section className="panel">
          <div className="section-title">
            <h2>Current Week Calendar</h2>
            <div className="week-nav">
              <button
                type="button"
                aria-label="Previous week"
                onClick={() => setCalendarWeekOffset((current) => current - 1)}
              >
                &lt;
              </button>
              <span>{formatWeekRange(calendarWeekOffset)}</span>
              <button
                type="button"
                aria-label="Next week"
                onClick={() => setCalendarWeekOffset((current) => current + 1)}
              >
                &gt;
              </button>
            </div>
          </div>
          <div className="week-calendar">
            {weekDays.map((day) => (
              <article className="day-column" key={day}>
                <h3>{day}</h3>
                {visibleCalendarTasksByDay[day].length === 0 && <p className="empty-day">No scheduled tasks.</p>}
                {visibleCalendarTasksByDay[day].map((task) => (
                  <div className={`mini-task ${task.type} ${task.status === "Done" ? "done" : ""}`} key={task.id}>
                    <strong>{task.title}</strong>
                    <span>{task.assignedTo}</span>
                    <small>{task.status}</small>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <h2>Priority Tasks</h2>
            <span>Start with the highest impact items</span>
          </div>
          <div className="task-list">
            {filteredTasks.slice(0, 2).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                commentDraft={commentDrafts[task.id] || ""}
                onCommentDraftChange={(value) =>
                  setCommentDrafts((current) => ({ ...current, [task.id]: value }))
                }
                onAddComment={() => handleAddComment(task.id)}
                onDelete={() => handleDeleteTask(task.id)}
                onEdit={() => goToTaskForm(task)}
                onToggle={() => handleToggleTask(task.id)}
              />
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderTasks() {
    return (
      <div className="task-columns">
        <section className="panel">
          <div className="section-title">
            <h2>Weekly Tasks</h2>
            <span>{weeklyTasks.length} repeating tasks</span>
          </div>
          <div className="task-list">
            {weeklyTasks.length === 0 && <p className="empty-day">No weekly tasks match this search.</p>}
            {weeklyTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                commentDraft={commentDrafts[task.id] || ""}
                onCommentDraftChange={(value) =>
                  setCommentDrafts((current) => ({ ...current, [task.id]: value }))
                }
                onAddComment={() => handleAddComment(task.id)}
                onDelete={() => handleDeleteTask(task.id)}
                onEdit={() => goToTaskForm(task)}
                onToggle={() => handleToggleTask(task.id)}
              />
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-title section-title-stack">
            <div>
              <h2>Daily Tasks</h2>
              <span>{selectedDay === currentDay ? "Showing today by default" : "Viewing selected day"}</span>
            </div>
            <select
              className="day-switcher"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
            >
              {weekDays.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
          <div className="task-list">
            {dailyTasks.length === 0 && <p className="empty-day">No tasks scheduled for {selectedDay}.</p>}
            {dailyTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                commentDraft={commentDrafts[task.id] || ""}
                onCommentDraftChange={(value) =>
                  setCommentDrafts((current) => ({ ...current, [task.id]: value }))
                }
                onAddComment={() => handleAddComment(task.id)}
                onDelete={() => handleDeleteTask(task.id)}
                onEdit={() => goToTaskForm(task)}
                onToggle={() => handleToggleTask(task.id)}
              />
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderTaskFormPage() {
    const isEditing = pageView === "edit-task";

    return (
      <section className="panel form-page-panel">
        <div className="section-title">
          <h2>{isEditing ? "Edit Task" : "Add Task"}</h2>
          <span>{isEditing ? "Update the task details." : "Create a new task on its own page."}</span>
        </div>
        <form onSubmit={handleTaskSubmit}>
          <label>Task Title</label>
          <input
            value={taskForm.title}
            onChange={(e) => setTaskForm((current) => ({ ...current, title: e.target.value }))}
            placeholder="Enter task title"
          />

          <div className="two-col">
            <div>
              <label>Assigned To</label>
              <input
                value={taskForm.assignedTo}
                onChange={(e) => setTaskForm((current) => ({ ...current, assignedTo: e.target.value }))}
                placeholder={`${siteLabel} Leadership`}
              />
            </div>

            <div>
              <label>Reminder</label>
              <input
                value={taskForm.reminder}
                onChange={(e) => setTaskForm((current) => ({ ...current, reminder: e.target.value }))}
                placeholder="8:00 AM"
              />
            </div>
          </div>

          <div className="two-col">
            <div>
              <label>Day</label>
              <select
                value={taskForm.day}
                onChange={(e) => setTaskForm((current) => ({ ...current, day: e.target.value }))}
              >
                {weekDays.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Priority</label>
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm((current) => ({ ...current, priority: e.target.value }))}
              >
                <option value="High">High</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={taskForm.repeating}
              onChange={(e) =>
                setTaskForm((current) => ({
                  ...current,
                  repeating: e.target.checked,
                }))
              }
            />
            <span>Repeat every week</span>
          </label>
          <div className="repeat-callout">
            <strong>{taskForm.repeating ? "Weekly Task" : "Daily Task"}</strong>
            <span>
              {taskForm.repeating
                ? "This task will repeat every week and appear in the weekly red section."
                : "This task will appear in the daily blue section for the selected day."}
            </span>
          </div>
          <p className="field-hint">
            Repeating tasks become weekly tasks. Unchecked tasks are treated as daily tasks for the selected week.
          </p>

          <label>Notes</label>
          <textarea
            value={taskForm.notes}
            onChange={(e) => setTaskForm((current) => ({ ...current, notes: e.target.value }))}
            placeholder="Add task details (optional)"
          />

          <div className="task-actions">
            <button className="primary-inline-btn" type="submit">
              <Plus size={15} /> {isEditing ? "Save Changes" : "Create Task"}
            </button>
            <button type="button" onClick={goToDashboard}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    );
  }

  function renderInquiryFormPage() {
    const isEditing = pageView === "edit-inquiry";

    return (
      <section className="panel form-page-panel">
        <div className="section-title">
          <h2>{isEditing ? "Edit Guest Inquiry" : "New Guest Inquiry"}</h2>
          <span>{isEditing ? "Update the guest details and inquiry notes." : "Create a new inquiry ticket."}</span>
        </div>
        <form onSubmit={handleInquirySubmit}>
          <div className="two-col">
            <div>
              <label>Guest Name</label>
              <input
                value={inquiryForm.guestName}
                onChange={(e) => setInquiryForm((current) => ({ ...current, guestName: e.target.value }))}
                placeholder="Guest full name"
              />
            </div>

            <div>
              <label>Phone Number</label>
              <input
                value={inquiryForm.phone}
                onChange={(e) => setInquiryForm((current) => ({ ...current, phone: e.target.value }))}
                placeholder="(555) 555-5555"
              />
            </div>
          </div>

          <label>Email Address</label>
          <input
            type="email"
            value={inquiryForm.email}
            onChange={(e) => setInquiryForm((current) => ({ ...current, email: e.target.value }))}
            placeholder="guest@email.com (optional)"
          />

          <label>Inquiry Notes</label>
          <textarea
            value={inquiryForm.inquiryFor}
            onChange={(e) => setInquiryForm((current) => ({ ...current, inquiryFor: e.target.value }))}
            placeholder="What is the guest asking about?"
          />

          <div className="task-actions">
            <button className="primary-inline-btn" type="submit">
              <Plus size={15} /> {isEditing ? "Save Inquiry" : "Create Inquiry"}
            </button>
            <button type="button" onClick={goToDashboard}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    );
  }

  function renderAnnouncementFormPage() {
    const isEditing = pageView === "edit-announcement";

    return (
      <section className="panel form-page-panel">
        <div className="section-title">
          <h2>{isEditing ? "Edit Announcement" : "Add Announcement"}</h2>
          <span>{isEditing ? "Update an existing announcement." : "Post the latest update for the week."}</span>
        </div>
        <form onSubmit={handleAnnouncementSubmit}>
          <label>Announcement Title</label>
          <input
            value={announcementForm.title}
            onChange={(e) => setAnnouncementForm((current) => ({ ...current, title: e.target.value }))}
            placeholder="Weekly Leadership Announcement"
          />

          <label>Announcement Body</label>
          <textarea
            value={announcementForm.body}
            onChange={(e) => setAnnouncementForm((current) => ({ ...current, body: e.target.value }))}
            placeholder="Write the update for the site team"
          />

          <div className="task-actions">
            <button className="primary-inline-btn" type="submit">
              <Plus size={15} /> {isEditing ? "Save Changes" : "Save Announcement"}
            </button>
            <button type="button" onClick={goToDashboard}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    );
  }

  function renderInquiries() {
    return (
      <section className="panel">
        <div className="section-title">
          <h2>Guest Inquiry Sheet</h2>
          <button className="primary-inline-btn inquiry-create-btn" type="button" onClick={() => goToInquiryForm()}>
            <Plus size={15} /> New Inquiry
          </button>
        </div>
        <div className="inquiry-groups">
          {inquiryGroups.length === 0 && <p className="empty-day">No guest inquiries yet.</p>}
          {inquiryGroups.map(([guestName, guestInquiries]) => (
            <section className="inquiry-group" key={guestName}>
              <div className="task-list">
                {guestInquiries.map((inquiry) => (
                  <InquiryCard
                    key={inquiry.id}
                    inquiry={inquiry}
                    commentDraft={inquiryCommentDrafts[inquiry.id] || ""}
                    onCommentDraftChange={(value) =>
                      setInquiryCommentDrafts((current) => ({ ...current, [inquiry.id]: value }))
                    }
                    onAddComment={() => handleAddInquiryComment(inquiry.id)}
                    onEdit={() => goToInquiryForm(inquiry)}
                    onToggleClosed={() => handleCloseInquiry(inquiry.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    );
  }

  function renderTeam() {
    return (
      <>
        <section className="panel team-section">
          <div className="section-title">
            <div>
              <h2>Team</h2>
              <span>Shared account with full task access for this site</span>
            </div>
            <button className="primary-inline-btn inquiry-create-btn" type="button" onClick={() => goToTeamForm()}>
              <Plus size={15} /> Manage Team
            </button>
          </div>
          <div className="leader-grid">
            {team.map((member) => (
              <article className="leader-card" key={member.id}>
                <div className="leader-avatar">
                  <UserRound size={18} />
                </div>
                <h3>{member.name}</h3>
                <p>{member.role}</p>
                <p>{siteLabel}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="task-split-layout">
          <div className="panel">
            <div className="section-title">
              <h2>Closed By</h2>
              <span>Today only</span>
            </div>
            <div className="count-list">
              {todayClosedCounts.length === 0 && <p className="empty-day">No tickets or tasks closed today.</p>}
              {todayClosedCounts.map((item) => (
                <article className="count-card" key={item.initials}>
                  <span>{item.initials}</span>
                  <strong>{item.total}</strong>
                </article>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="section-title">
              <h2>Task History</h2>
              <span>Initials and total closures</span>
            </div>
            <div className="count-list history-summary-list">
              {historyCounts.length === 0 && <p className="empty-day">No task or ticket history yet.</p>}
              {historyCounts.map((item) => (
                <article className="count-card" key={item.initials}>
                  <span>{item.initials}</span>
                  <strong>{item.total}</strong>
                </article>
              ))}
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderTeamManagementPage() {
    return (
      <div className="task-columns">
        <section className="panel form-page-panel">
          <div className="section-title">
            <h2>{teamForm.id ? "Edit Team Member" : "Team Settings"}</h2>
            <span>Update the people shown in the Team section.</span>
          </div>
          <form onSubmit={handleTeamSubmit}>
            <label>Name</label>
            <input
              value={teamForm.name}
              onChange={(e) => setTeamForm((current) => ({ ...current, name: e.target.value }))}
              placeholder="Enter team member name"
            />

            <label>Role</label>
            <select
              value={teamForm.role}
              onChange={(e) => setTeamForm((current) => ({ ...current, role: e.target.value }))}
            >
              <option value="Site Lead">Site Lead</option>
              <option value="Assistant Site Leader">Assistant Site Leader</option>
              <option value="Team Member">Team Member</option>
            </select>

            <div className="task-actions">
              <button className="primary-inline-btn" type="submit">
                <Plus size={15} /> {teamForm.id ? "Save Member" : "Add Member"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTeamForm(defaultTeamForm);
                  setSearchParams({ view: "team-settings" });
                }}
              >
                Clear
              </button>
              <button type="button" onClick={goToDashboard}>
                Back
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="section-title">
            <h2>Current Team</h2>
            <span>{team.length} people</span>
          </div>
          <div className="task-list">
            {team.length === 0 && <p className="empty-day">No team members added yet.</p>}
            {team.map((member) => (
              <article className="leader-card" key={member.id}>
                <div className="leader-avatar">
                  <UserRound size={18} />
                </div>
                <h3>{member.name}</h3>
                <p>{member.role}</p>
                <div className="task-actions">
                  <button type="button" onClick={() => goToTeamForm(member)}>
                    <Pencil size={15} /> Edit
                  </button>
                  <button className="danger" type="button" onClick={() => handleDeleteTeamMember(member.id)}>
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderPageContent() {
    if (pageView === "new-task" || pageView === "edit-task") {
      return renderTaskFormPage();
    }

    if (pageView === "new-inquiry" || pageView === "edit-inquiry") {
      return renderInquiryFormPage();
    }

    if (pageView === "new-announcement" || pageView === "edit-announcement") {
      return renderAnnouncementFormPage();
    }

    if (pageView === "team-settings" || pageView === "edit-team-member") {
      return renderTeamManagementPage();
    }

    if (activeTab === "home") return renderHome();
    if (activeTab === "tasks") return renderTasks();
    if (activeTab === "inquiries") return renderInquiries();
    return renderTeam();
  }

  return (
    <main className="app-shell">
      <button className="menu-toggle" type="button" onClick={() => setSidebarOpen((open) => !open)}>
        {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
      </button>

      <div className={`app ${sidebarOpen ? "with-sidebar" : "without-sidebar"}`}>
        <aside className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
          <button
            className="brand"
            type="button"
            onClick={() => {
              setActiveTab("home");
              goToDashboard();
            }}
          >
            <img src="/trackops-logo.png" alt="TrackOps logo" />
            {sidebarOpen && <span>TrackOps</span>}
          </button>

          <nav>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={pageView === "dashboard" && activeTab === item.id ? "active" : ""}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                    goToDashboard();
                  }}
                >
                  <Icon size={16} />
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>

          <button className="logout" type="button" onClick={logout}>
            <LogOut size={16} />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </aside>

        <section className="content">
          <div className="page-heading">{siteLabel} Dashboard</div>

          <div className="topbar">
            <div className="search-stack">
              <div className="search-box">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tasks and comments"
                />
              </div>
              <div className="site-context">
                <span>Signed in as</span>
                <span>{profile?.email}</span>
                <span>Full site access</span>
              </div>
            </div>

            <div className="top-actions">
              <button className="add-task-btn" type="button" onClick={() => goToTaskForm()}>
                <Plus size={14} /> Add Task
              </button>
              <details className="profile-menu">
                <summary className="avatar avatar-button" aria-label="Open profile menu">
                  {profile?.photoDataUrl ? (
                    <img src={profile.photoDataUrl} alt={`${accountName} profile`} />
                  ) : (
                    <span>{accountName.slice(0, 2).toUpperCase()}</span>
                  )}
                </summary>
                <div className="profile-menu-dropdown">
                  <div className="profile-menu-copy">
                    <strong>{accountName}</strong>
                    <span>{profile?.email}</span>
                  </div>
                  <button className="profile-menu-item" type="button" onClick={() => navigate("/profile")}>
                    <UserRound size={14} /> Profile
                  </button>
                  <button
                    className="profile-menu-item"
                    type="button"
                    onClick={() => setSearchParams({ view: "team-settings" })}
                  >
                    <Users size={14} /> Team
                  </button>
                  <button className="profile-menu-item" type="button" onClick={logout}>
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </details>
            </div>
          </div>

          {renderPageContent()}

          <section className="content-grid">
            <article className="info-card">
              <h2>
                <ShieldCheck size={15} /> Site Access
              </h2>
              <p>This account has full access for {siteLabel}, including task creation, editing, deleting, and comments.</p>
            </article>
            <article className="info-card">
              <h2>
                <Truck size={15} /> Operations Reminder
              </h2>
              <p>Use this dashboard to track open work, announcements, and detergent shipment follow-up for the site.</p>
            </article>
            <article className="info-card">
              <h2>
                <CalendarDays size={15} /> This Week
              </h2>
              <p>Stay current on weekly tasks, daily follow-up, and guest inquiries that need a response.</p>
            </article>
          </section>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, compact = false }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong style={compact ? { fontSize: "16px", lineHeight: 1.3 } : undefined}>{value}</strong>
    </article>
  );
}

function TaskCard({
  task,
  commentDraft,
  onCommentDraftChange,
  onAddComment,
  onDelete,
  onEdit,
  onToggle,
}) {
  return (
    <article className={`task-card ${task.type} ${task.status === "Done" ? "done" : ""}`}>
      <div className="task-top">
        <span className="task-id">{task.id}</span>
        <span className={`badge ${task.priority.toLowerCase()}`}>{task.priority}</span>
      </div>

      <h3>{task.title}</h3>
      <div className="task-meta">
        <span>
          <UserRound size={14} /> {task.assignedTo}
        </span>
        <span>
          <CalendarDays size={14} /> {task.day}
        </span>
        <span>
          <ClipboardList size={14} /> {task.status}
        </span>
      </div>

      {task.notes ? <p>{task.notes}</p> : <p className="task-empty-copy">No notes added.</p>}
      <p className="task-submeta">
        Assigned by {task.assignedBy} • Reminder: {task.reminder}
      </p>
      {task.completedAt && (
        <p className="task-submeta">
          Completed by {task.completedBy} • {task.completedAt}
        </p>
      )}

      <section className="comments-block">
        <div className="comments-heading">
          <span>
            <MessageSquareText size={14} /> Comments
          </span>
          <small>{task.comments.length} total</small>
        </div>

        {task.comments.length === 0 && <p className="empty-day comments-empty">No comments yet.</p>}

        {task.comments.map((comment) => (
          <article className="comment-card" key={comment.id}>
            <strong>{comment.author}</strong>
            <small>{comment.createdAt}</small>
            <p>{comment.message}</p>
          </article>
        ))}

        <div className="comment-entry">
          <textarea
            value={commentDraft}
            onChange={(e) => onCommentDraftChange(e.target.value)}
            placeholder="Add a comment for this task"
          />
          <button type="button" onClick={onAddComment}>
            Post Comment
          </button>
        </div>
      </section>

      <div className="task-actions">
        <button type="button" onClick={onToggle}>
          <CheckCircle2 size={15} /> {task.status === "Open" ? "Mark Done" : "Reopen"}
        </button>
        <button type="button" onClick={onEdit}>
          <Pencil size={15} /> Edit
        </button>
        <button className="danger" type="button" onClick={onDelete}>
          <Trash2 size={15} /> Delete
        </button>
      </div>
    </article>
  );
}

function InquiryCard({
  inquiry,
  commentDraft,
  onCommentDraftChange,
  onAddComment,
  onEdit,
  onToggleClosed,
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <article className={`inquiry-card ${inquiry.status === "Closed" ? "closed" : ""}`}>
      <button className="inquiry-toggle" type="button" onClick={() => setIsOpen((current) => !current)}>
        <div className="inquiry-toggle-copy">
          <strong>{inquiry.guestName}</strong>
          <span>{inquiry.status === "Closed" ? "Closed ticket" : "Open ticket"}</span>
        </div>
        <div className="inquiry-toggle-meta">
          <span className={`badge ${inquiry.status === "Closed" ? "low" : "high"}`}>{inquiry.status}</span>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {isOpen && (
        <>
          <p>{inquiry.inquiryFor}</p>

          <div className="inquiry-meta-grid">
            <div className="inquiry-meta-item">
              <span>Phone</span>
              <strong>{inquiry.phone}</strong>
            </div>
            <div className="inquiry-meta-item">
              <span>Email</span>
              <strong>{inquiry.email || "No email provided"}</strong>
            </div>
          </div>

          <p className="task-submeta">
            Created by {inquiry.createdBy} • {inquiry.createdAt}
          </p>
          {inquiry.closedAt && <p className="task-submeta">Closed at {inquiry.closedAt}</p>}

          <section className="comments-block">
            <div className="comments-heading">
              <span>
                <MessageSquareText size={14} /> Comments
              </span>
              <small>{inquiry.comments.length} total</small>
            </div>

            {inquiry.comments.length === 0 && <p className="empty-day comments-empty">No comments yet.</p>}

            {inquiry.comments.map((comment) => (
              <article className="comment-card" key={comment.id}>
                <strong>{comment.author}</strong>
                <small>{comment.createdAt}</small>
                <p>{comment.message}</p>
              </article>
            ))}

            <div className="comment-entry">
              <textarea
                value={commentDraft}
                onChange={(e) => onCommentDraftChange(e.target.value)}
                placeholder="Add a comment to this inquiry"
              />
              <button type="button" onClick={onAddComment}>
                Post Comment
              </button>
            </div>
          </section>

          <div className="task-actions">
            <button type="button" onClick={onEdit}>
              <Pencil size={15} /> Edit
            </button>
            <button type="button" onClick={onToggleClosed}>
              <CheckCircle2 size={15} /> Close Ticket
            </button>
          </div>
        </>
      )}
    </article>
  );
}
