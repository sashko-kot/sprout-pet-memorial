import { useEffect, useState } from "react";
import Auth from "./Auth";
import Calculator from "./Calculator";
import Dashboard from "./Dashboard";
import MapZones from "./MapZones";
import Profile from "./Profile";
import { clearTokens } from "./api";

function readStoredProfile() {
  try {
    return JSON.parse(localStorage.getItem("ecopet_profile") || "null");
  } catch {
    return null;
  }
}

const screens = [
  { id: "dashboard", label: "Мой сад", icon: "home" },
  { id: "calculator", label: "Создать мемориал", icon: "leaf" },
  { id: "map", label: "Эко-парки", icon: "pin" },
];

export function Icon({ name, size = 20 }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    leaf: <><path d="M19.5 3.5C12 3.5 5 7 5 13c0 2.8 2.2 5 5 5 6 0 9.5-7 9.5-14.5Z" /><path d="M4 21c2-5 5.5-8 10.5-11" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.6-4.2 3.3-6 8-6s7.4 1.8 8 6" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    arrow: <path d="m9 18 6-6-6-6" />,
    back: <path d="m15 18-6-6 6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 14v6h14v-6" /></>,
    download: <><path d="M12 4v12m0 0 5-5m-5 5-5-5" /><path d="M5 20h14" /></>,
    logout: <><path d="M10 5H4v14h6M14 8l4 4-4 4m4-4H8" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    calendar: <><path d="M5 4v3m14-3v3M3 9h18M4 6h16v15H4z" /></>,
    water: <path d="M12 3S6 10 6 15a6 6 0 0 0 12 0c0-5-6-12-6-12Z" />,
    sprout: <><path d="M12 21v-9M12 14c-5 0-7-3-7-7 5 0 7 3 7 7ZM12 11c0-4 2-7 7-7 0 4-2 7-7 7Z" /></>,
    location: <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 4-4 2 2-4 4-2Z" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function App() {
  const [screen, setScreen] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem("ecopet_token")));
  const [memorial, setMemorial] = useState(null);
  const [pendingPet, setPendingPet] = useState(null);
  const [profile, setProfile] = useState(readStoredProfile);

  useEffect(() => {
    document.title = "EcoPet Planner — память, которая растёт";
  }, []);

  const navigate = (nextScreen) => {
    setScreen(nextScreen);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const logout = () => {
    clearTokens();
    localStorage.removeItem("ecopet_profile");
    setProfile(null);
    setAuthenticated(false);
  };

  const handleAuthSuccess = (userProfile) => {
    localStorage.setItem("ecopet_profile", JSON.stringify(userProfile));
    setProfile(userProfile);
    setAuthenticated(true);
  };

  if (!authenticated) {
    return <Auth onSuccess={handleAuthSuccess} />;
  }

  const profileName = profile?.username || profile?.email || "Мой аккаунт";
  const profileInitials = profileName.slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("dashboard")} aria-label="На главную">
          <span className="brand-mark"><Icon name="sprout" size={25} /></span>
          <span>EcoPet <b>Planner</b></span>
        </button>

        <nav className="desktop-nav" aria-label="Основная навигация">
          {screens.map((item) => (
            <button key={item.id} className={`nav-link ${screen === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <button className="icon-button notification" aria-label="Уведомления"><Icon name="bell" /></button>
          <button className="profile-button" onClick={() => navigate("profile")}>
            <span className="avatar">{profileInitials}</span>
            <span className="profile-copy"><b>{profileName}</b><small>Личный кабинет</small></span>
          </button>
          <button className="icon-button desktop-logout" onClick={logout} aria-label="Выйти">
            <Icon name="logout" />
          </button>
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Открыть меню">
            <Icon name={mobileOpen ? "close" : "menu"} />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <nav className="mobile-nav">
          {screens.map((item) => (
            <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => navigate(item.id)}>
              <Icon name={item.icon} /> {item.label}
            </button>
          ))}
          <button className={screen === "profile" ? "active" : ""} onClick={() => navigate("profile")}>
            <Icon name="user" /> Личный кабинет
          </button>
          <button onClick={logout}><Icon name="logout" /> Выйти</button>
        </nav>
      )}

      <main>
        {screen === "dashboard" && <Dashboard onCreate={() => { setMemorial(null); setPendingPet(null); navigate("calculator"); }} onMap={() => navigate("map")} />}
        {screen === "profile" && <Profile
          onProfileUpdated={setProfile}
          onCreateMemorial={(pet) => { setMemorial(null); setPendingPet(pet); navigate("calculator"); }}
        />}
        {screen === "calculator" && <Calculator
          initialPet={pendingPet}
          onCreated={(createdMemorial) => { setMemorial(createdMemorial); setPendingPet(null); }}
          onMap={() => navigate("map")}
          onFinished={() => { setMemorial(null); setPendingPet(null); navigate("dashboard"); }}
        />}
        {screen === "map" && <MapZones
          memorial={memorial}
          onCreate={() => navigate("calculator")}
          onPlantingCreated={() => { setMemorial(null); setPendingPet(null); navigate("dashboard"); }}
        />}
      </main>

      <footer>
        <button className="brand footer-brand" onClick={() => navigate("dashboard")}>
          <span className="brand-mark"><Icon name="sprout" size={22} /></span>
          <span>EcoPet <b>Planner</b></span>
        </button>
        <p>Бережно храним память и помогаем природе расти.</p>
        <span>© 2025 EcoPet Planner</span>
      </footer>
    </div>
  );
}
