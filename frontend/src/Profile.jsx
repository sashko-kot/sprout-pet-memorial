import { useEffect, useState } from "react";
import { Icon } from "./App";
import { apiRequest } from "./api";
import DatePicker from "./DatePicker";

function calculateAgeAtDeath(birthDate, deathDate) {
  if (!birthDate || !deathDate) return "";
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [deathYear, deathMonth, deathDay] = deathDate.split("-").map(Number);
  if (deathDate < birthDate) return "";
  return deathYear - birthYear - (deathMonth < birthMonth || (deathMonth === birthMonth && deathDay < birthDay) ? 1 : 0);
}

function PetEditor({ pet, onCreateMemorial, onDelete, deleting, deleteDisabled }) {
  const [savedPhoto, setSavedPhoto] = useState(pet.photo);
  const [form, setForm] = useState({
    name: pet.name || "",
    species: pet.species || "",
    breed: pet.breed || "",
    weight_kg: pet.weight_kg ?? "",
    birth_date: pet.birth_date || "",
    death_date: pet.death_date || "",
    photo: null,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const update = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
    setSaved(false);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    const data = new FormData();
    data.append("name", form.name);
    data.append("species", form.species);
    data.append("breed", form.breed);
    data.append("weight_kg", String(form.weight_kg));
    data.append("birth_date", form.birth_date);
    data.append("death_date", form.death_date);
    if (form.photo) data.append("photo", form.photo);

    try {
      const updatedPet = await apiRequest(`/calculator/pets/${pet.id}/`, { method: "PATCH", body: data });
      setSavedPhoto(updatedPet.photo);
      setSaved(true);
      setForm((current) => ({ ...current, photo: null }));
    } catch (requestError) {
      setError(requestError.message || "Не удалось сохранить карточку питомца.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="pet-editor-card" onSubmit={save}>
      <div className="pet-editor-heading">
        <div className="pet-profile-photo">
          {savedPhoto
            ? <img src={savedPhoto} alt={`Фото питомца ${form.name}`} />
            : <Icon name="sprout" size={34} />}
        </div>
        <div><span className="eyebrow">КАРТОЧКА ПИТОМЦА</span><h2>{form.name || "Питомец"}</h2></div>
        <button
          className="danger-button pet-delete-button"
          type="button"
          disabled={deleting || deleteDisabled || saving}
          aria-label={`Удалить карточку питомца ${form.name}`}
          onClick={() => onDelete(pet)}
        >
          {deleting ? <span className="loader" /> : "Удалить питомца"}
        </button>
      </div>
      <div className="profile-form-grid">
        <label>Имя<input name="name" value={form.name} onChange={update} required /></label>
        <label>Вид<input name="species" value={form.species} onChange={update} required /></label>
        <label>Порода<input name="breed" value={form.breed} onChange={update} /></label>
        <label>Вес, кг<input type="number" min="0.1" step="0.1" name="weight_kg" value={form.weight_kg} onChange={update} required /></label>
        <label>Дата рождения<DatePicker name="birth_date" value={form.birth_date} onChange={update} /></label>
        <label>Дата ухода<DatePicker name="death_date" value={form.death_date} onChange={update} /></label>
        <label>Возраст на дату ухода, лет<input value={calculateAgeAtDeath(form.birth_date, form.death_date)} readOnly placeholder="Укажите обе даты" /></label>
        <label className="upload-field profile-photo-upload">
          <input type="file" accept="image/*" onChange={(event) => setForm({ ...form, photo: event.target.files?.[0] || null })} />
          <Icon name="upload" />
          <span><b>{form.photo ? form.photo.name : "Изменить фотографию"}</b><small>JPG или PNG до 10 МБ</small></span>
        </label>
      </div>
      <button className="secondary-button pet-memorial-button" type="button" onClick={() => onCreateMemorial(pet)}>
        Продолжить создание мемориала <Icon name="arrow" />
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && <p className="profile-saved" role="status">Карточка питомца сохранена.</p>}
      <button className="primary-button" disabled={saving}>{saving ? <span className="loader" /> : "Сохранить карточку"} {!saving && <Icon name="check" />}</button>
    </form>
  );
}

export default function Profile({ onProfileUpdated, onCreateMemorial }) {
  const [profile, setProfile] = useState({ username: "", email: "", phone: "" });
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingPetId, setDeletingPetId] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest("/auth/profile/"),
      apiRequest("/calculator/pets/"),
    ])
      .then(([profileData, petData]) => {
        setProfile({
          username: profileData.username || "",
          email: profileData.email || "",
          phone: profileData.phone || "",
        });
        setPets(petData);
      })
      .catch((requestError) => setError(requestError.message || "Не удалось загрузить личный кабинет."))
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updatedProfile = await apiRequest("/auth/profile/", {
        method: "PATCH",
        body: profile,
      });
      setProfile({
        username: updatedProfile.username || "",
        email: updatedProfile.email || "",
        phone: updatedProfile.phone || "",
      });
      onProfileUpdated(updatedProfile);
      localStorage.setItem("ecopet_profile", JSON.stringify(updatedProfile));
      setSaved(true);
    } catch (requestError) {
      setError(requestError.message || "Не удалось сохранить личные данные.");
    } finally {
      setSaving(false);
    }
  };

  const deletePet = async (pet) => {
    const confirmed = window.confirm(
      `Удалить питомца «${pet.name}»? Связанные расчёты, посадки и записи дневника также будут удалены. Это действие нельзя отменить.`,
    );
    if (!confirmed) return;

    setDeletingPetId(pet.id);
    setError("");
    try {
      await apiRequest(`/calculator/pets/${pet.id}/`, { method: "DELETE" });
      setPets((currentPets) => currentPets.filter((currentPet) => currentPet.id !== pet.id));
    } catch (requestError) {
      setError(requestError.message || "Не удалось удалить карточку питомца.");
    } finally {
      setDeletingPetId(null);
    }
  };

  if (loading) {
    return <div className="page"><div className="dashboard-loading"><span className="loader green" /><p>Загружаем личный кабинет…</p></div></div>;
  }

  return (
    <div className="page profile-page">
      <header className="dashboard-welcome">
        <div><span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h1>Ваш профиль</h1><p>Изменяйте контактные данные и карточки питомцев.</p></div>
      </header>

      {error && <p className="form-error profile-error" role="alert">{error}</p>}

      <section className="profile-section">
        <div className="section-heading"><div><span className="eyebrow">АККАУНТ</span><h2>Личные данные</h2></div></div>
        <form className="account-editor-card" onSubmit={saveProfile}>
          <div className="profile-form-grid">
            <label>Имя<input name="username" value={profile.username} onChange={(event) => { setProfile({ ...profile, username: event.target.value }); setSaved(false); }} required /></label>
            <label>Email<input type="email" name="email" value={profile.email} onChange={(event) => { setProfile({ ...profile, email: event.target.value }); setSaved(false); }} required /></label>
            <label>Телефон<input type="tel" name="phone" value={profile.phone} onChange={(event) => { setProfile({ ...profile, phone: event.target.value }); setSaved(false); }} /></label>
          </div>
          {saved && <p className="profile-saved" role="status">Личные данные сохранены.</p>}
          <button className="primary-button" disabled={saving}>{saving ? <span className="loader" /> : "Сохранить данные"} {!saving && <Icon name="check" />}</button>
        </form>
      </section>

      <section className="profile-section">
        <div className="section-heading"><div><span className="eyebrow">ПИТОМЦЫ</span><h2>Карточки питомцев</h2></div></div>
        {pets.length === 0
          ? <div className="empty-state compact"><span><Icon name="leaf" /></span><h3>Пока нет карточек</h3><p>Создайте мемориал — данные питомца появятся здесь и их можно будет редактировать.</p></div>
          : <div className="pet-editor-list">{pets.map((pet) => (
            <PetEditor
              key={pet.id}
              pet={pet}
              onCreateMemorial={onCreateMemorial}
              onDelete={deletePet}
              deleting={deletingPetId === pet.id}
              deleteDisabled={deletingPetId !== null}
            />
          ))}</div>}
      </section>
    </div>
  );
}
