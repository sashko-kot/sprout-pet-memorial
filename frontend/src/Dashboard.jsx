import { useEffect, useState } from "react";
import { Icon } from "./App";
import { apiRequest } from "./api";

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function toLogView(log) {
  const title = log.title || "Запись ухода";
  return {
    ...log,
    date: formatDate(log.event_date),
    text: log.description,
    type: /полив|water/i.test(title) ? "water" : /рост|лист|growth/i.test(title) ? "growth" : "care",
  };
}

function formatTreeCount(count) {
  const lastTwoDigits = count % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} деревьев`;
  if (count % 10 === 1) return `${count} дерево`;
  if (count % 10 >= 2 && count % 10 <= 4) return `${count} дерева`;
  return `${count} деревьев`;
}

export default function Dashboard({ onCreate, onMap }) {
  const [plantings, setPlantings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingPlanting, setDeletingPlanting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPlantingId, setSelectedPlantingId] = useState(null);
  const [entry, setEntry] = useState({ title: "", text: "", photo: null });

  useEffect(() => {
    Promise.all([
      apiRequest("/tracker/plantings/"),
      apiRequest("/calculator/pets/"),
      apiRequest("/calculator/tree-species/", { auth: false }),
      apiRequest("/zones/", { auth: false }),
    ])
      .then(([plantingData, pets, treeSpecies, zones]) => {
        const plantingList = plantingData.map((planting) => {
          const ageDays = Math.max(0, Math.floor((Date.now() - new Date(planting.planting_date).getTime()) / 86400000));
          return {
            ...planting,
            pet_name: pets.find((pet) => pet.id === planting.pet)?.name || "Питомец",
            tree_name: treeSpecies.find((tree) => tree.id === planting.tree_species)?.title || "Дерево",
            zone_name: zones.find((zone) => zone.id === planting.eco_zone)?.name || planting.location_details,
            planted_at: formatDate(planting.planting_date),
            age_days: ageDays,
            progress: Math.min(100, Math.round((ageDays / 365) * 100)),
            next_care: planting.status || "Добавьте запись ухода",
          };
        });
        setPlantings(plantingList);
        setSelectedPlantingId((current) => current || plantingList[0]?.id || null);
        setLogs((plantingList[0]?.care_logs || []).map(toLogView));
      })
      .catch((requestError) => setError(requestError.message || "Не удалось загрузить данные сада."))
      .finally(() => setLoading(false));
  }, []);

  const planting = plantings.find((item) => item.id === selectedPlantingId) || plantings[0];

  useEffect(() => {
    setLogs((planting?.care_logs || []).map(toLogView));
  }, [planting]);

  const addLog = async (event) => {
    event.preventDefault();
    setSaving(true);
    const data = new FormData();
    data.append("planted_tree", planting?.id || "");
    data.append("event_date", new Date().toISOString().slice(0, 10));
    data.append("title", entry.title);
    data.append("description", entry.text);
    if (entry.photo) data.append("photo", entry.photo);
    try {
      const saved = await apiRequest("/tracker/logs/add/", {
        method: "POST",
        body: data,
      });
      setLogs([toLogView(saved), ...logs]);
      setPlantings((current) => current.map((item) => (
        item.id === planting.id
          ? { ...item, care_logs: [saved, ...(item.care_logs || [])] }
          : item
      )));
      setShowForm(false);
      setEntry({ title: "", text: "", photo: null });
    } catch (requestError) {
      setError(requestError.message || "Не удалось сохранить запись.");
    } finally {
      setSaving(false);
    }
  };

  const deletePlanting = async () => {
    const confirmed = window.confirm(
      `Удалить дерево «${planting.tree_name}» в память о питомце «${planting.pet_name}»? Записи дневника этого дерева также будут удалены. Это действие нельзя отменить.`,
    );
    if (!confirmed) return;

    setDeletingPlanting(true);
    setDeleteError("");
    try {
      await apiRequest(`/tracker/plantings/${planting.id}/`, { method: "DELETE" });
      const remainingPlantings = plantings.filter((item) => item.id !== planting.id);
      setPlantings(remainingPlantings);
      setSelectedPlantingId(remainingPlantings[0]?.id || null);
      setLogs((remainingPlantings[0]?.care_logs || []).map(toLogView));
    } catch (requestError) {
      setDeleteError(requestError.message || "Не удалось удалить дерево.");
    } finally {
      setDeletingPlanting(false);
    }
  };

  if (loading) {
    return <div className="page"><div className="dashboard-loading"><span className="loader green" /><p>Собираем новости вашего сада…</p></div></div>;
  }

  if (plantings.length === 0) {
    return (
      <div className="page">
        <section className="empty-state">
          <span className="empty-illustration"><Icon name="sprout" size={54} /></span>
          <span className="eyebrow">ВАШ САД ГОТОВ РАСТИ</span>
          <h1>Здесь появится первая история</h1>
          <p>{deleteError || error || "Создайте экологичный мемориал — мы поможем выбрать капсулу, дерево и особое место."}</p>
          <button className="primary-button" onClick={onCreate}>Создать мемориал <Icon name="arrow" /></button>
        </section>
      </div>
    );
  }

  return (
    <div className="page dashboard-page">
      <header className="dashboard-welcome">
        <div><span className="eyebrow">ВАШ ЖИВОЙ САД</span><h1>Ваш сад растёт</h1><p>Сегодня хороший день, чтобы вспомнить важное и позаботиться о будущем.</p></div>
        <button className="primary-button" onClick={onCreate}><Icon name="plus" /> Новый мемориал</button>
      </header>
      {deleteError && <p className="form-error" role="alert">{deleteError}</p>}

      <section className="garden-tree-section" aria-label="Все деревья">
        <div className="section-heading">
          <div><span className="eyebrow">ВАШИ ПОСАДКИ</span><h2>Все деревья</h2></div>
          <span className="tree-count">{formatTreeCount(plantings.length)}</span>
        </div>
        <div className="garden-tree-grid">
          {plantings.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`garden-tree-card ${planting.id === item.id ? "selected" : ""}`}
              aria-pressed={planting.id === item.id}
              onClick={() => setSelectedPlantingId(item.id)}
            >
              <span className="garden-tree-icon"><Icon name="sprout" size={30} /></span>
              <span className="garden-tree-copy">
                <b>{item.tree_name}</b>
                <small>В память о {item.pet_name}</small>
                <small><Icon name="pin" size={13} /> {item.zone_name || item.location_details}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="garden-hero">
        <div className="garden-art">
          <span className="sun" />
          <span className="hill hill-back" />
          <span className="hill hill-front" />
          <span className="hero-tree"><Icon name="sprout" size={86} /></span>
          <span className="garden-caption">Каждый новый лист — продолжение истории</span>
        </div>
        <div className="garden-summary">
          <div className="summary-top">
            <span className="status-dot">Дерево растёт</span>
            <button className="danger-button compact" type="button" disabled={deletingPlanting} onClick={deletePlanting}>
              {deletingPlanting ? <span className="loader" /> : "Удалить дерево"}
            </button>
          </div>
          <span className="eyebrow">В ПАМЯТЬ О {planting.pet_name?.toUpperCase()}</span>
          <h2>{planting.tree_name}</h2>
          <p className="location-line"><Icon name="pin" size={16} /> {planting.zone_name}</p>
          <div className="stats-row">
            <div><small>ПОСАЖЕНО</small><b>{planting.planted_at}</b></div>
            <div><small>ВОЗРАСТ</small><b>{planting.age_days} дней</b></div>
          </div>
          <div className="growth-progress">
            <div><span>Первый год роста</span><b>{planting.progress}%</b></div>
            <span className="progress-track"><i style={{ width: `${planting.progress}%` }} /></span>
          </div>
          <div className="next-care"><span><Icon name="water" /></span><div><small>СЛЕДУЮЩАЯ ЗАБОТА</small><b>{planting.next_care}</b></div><Icon name="arrow" /></div>
        </div>
      </section>

      <section className="dashboard-columns">
        <div className="journal-section">
          <div className="section-heading"><div><span className="eyebrow">ДНЕВНИК РОСТА</span><h2>История дерева «{planting.tree_name}»</h2></div><button className="secondary-button" onClick={() => setShowForm(true)}><Icon name="plus" /> Добавить запись</button></div>
          <div className="timeline">
            {logs.length === 0 ? (
              <div className="empty-state compact"><span><Icon name="calendar" /></span><h3>Дневник пока пуст</h3><p>Добавьте первую заметку об уходе.</p></div>
            ) : logs.map((log) => (
              <article className="timeline-entry" key={log.id}>
                <div className="timeline-date">{log.date}</div>
                <span className={`timeline-icon ${log.type}`}><Icon name={log.type === "water" ? "water" : log.type === "growth" ? "sprout" : "leaf"} /></span>
                <div className="timeline-card"><h3>{log.title}</h3><p>{log.text}</p><button>Читать запись <Icon name="arrow" size={15} /></button></div>
              </article>
            ))}
          </div>
        </div>
        <aside className="side-cards">
          <article className="impact-card"><span className="soft-icon"><Icon name="leaf" /></span><small>ВАШ ВКЛАД</small><h3>Природа говорит спасибо</h3><div><b>12.4</b><span>кг CO₂<br />поглощено</span></div><p>Примерно столько очищает молодое дерево за первый год.</p></article>
          <article className="place-card"><div><span className="eyebrow light">{planting.eco_zone ? "ВАШ ЭКО-ПАРК" : "МЕСТО ПОСАДКИ"}</span><h3>{planting.zone_name || planting.location_details}</h3>{planting.eco_zone && <p>Истринский район · 34 км</p>}</div>{planting.eco_zone && <button onClick={onMap}>Посмотреть на карте <Icon name="arrow" /></button>}</article>
        </aside>
      </section>

      {showForm && (
        <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}>
          <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowForm(false)}><Icon name="close" /></button>
            <span className="soft-icon"><Icon name="sprout" /></span>
            <span className="eyebrow">НОВАЯ ЗАПИСЬ</span>
            <h2>Как поживает дерево?</h2>
            <p>Сохраните наблюдение или важный момент.</p>
            <form onSubmit={addLog}>
              {error && <p className="form-error" role="alert">{error}</p>}
              <label>Заголовок<input value={entry.title} onChange={(event) => setEntry({ ...entry, title: event.target.value })} placeholder="Например, Первый весенний лист" required /></label>
              <label>Заметка<textarea value={entry.text} onChange={(event) => setEntry({ ...entry, text: event.target.value })} placeholder="Расскажите, что изменилось…" rows="4" required /></label>
              <label className="upload-field"><input type="file" accept="image/*" onChange={(event) => setEntry({ ...entry, photo: event.target.files[0] })} /><Icon name="upload" /><span><b>{entry.photo ? entry.photo.name : "Добавить фотографию"}</b><small>JPG или PNG до 10 МБ</small></span></label>
              <button className="primary-button full" disabled={saving}>{saving ? <span className="loader" /> : "Сохранить запись"} {!saving && <Icon name="arrow" />}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
