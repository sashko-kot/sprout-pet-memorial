import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "./App";
import { apiRequest } from "./api";

const defaultCenter = [55.751244, 37.618423];
const markerIcon = L.divIcon({
  className: "eco-map-marker",
  html: '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21v-9M12 14c-5 0-7-3-7-7 5 0 7 3 7 7ZM12 11c0-4 2-7 7-7 0 4-2 7-7 7Z"/></svg></span>',
  iconSize: [42, 42],
  iconAnchor: [21, 42],
});
const activeMarkerIcon = L.divIcon({
  className: "eco-map-marker active",
  html: '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21v-9M12 14c-5 0-7-3-7-7 5 0 7 3 7 7ZM12 11c0-4 2-7 7-7 0 4-2 7-7 7Z"/></svg></span>',
  iconSize: [48, 48],
  iconAnchor: [24, 48],
});

function MapViewport({ zones, selected }) {
  const map = useMap();
  const initialized = useRef(false);

  useEffect(() => {
    if (zones.length === 0) return;

    const points = zones.map((zone) => [Number(zone.latitude), Number(zone.longitude)]);
    if (points.length === 1) {
      map.setView(points[0], 11);
    } else {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 11 });
    }
  }, [map, zones]);

  useEffect(() => {
    if (!selected) return;
    if (!initialized.current) {
      initialized.current = true;
      return;
    }

    map.flyTo([Number(selected.latitude), Number(selected.longitude)], Math.max(map.getZoom(), 11), {
      duration: 0.5,
    });
  }, [map, selected]);

  return null;
}

function MapZoomControls() {
  const map = useMap();

  return (
    <div
      className="map-controls"
      onMouseDownCapture={(event) => event.stopPropagation()}
      onClickCapture={(event) => event.stopPropagation()}
    >
      <button aria-label="Приблизить" onClick={() => map.zoomIn()}>+</button>
      <button aria-label="Отдалить" onClick={() => map.zoomOut()}>−</button>
    </div>
  );
}

function hasValidCoordinates(zone) {
  const latitude = Number(zone.latitude);
  const longitude = Number(zone.longitude);
  return Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90
    && Number.isFinite(longitude)
    && longitude >= -180
    && longitude <= 180;
}

export default function MapZones({ memorial, onPlantingCreated, onCreate }) {
  const [zones, setZones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest("/zones/", { auth: false })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error("Сервер вернул некорректный список зон.");
        }
        const list = data.filter(hasValidCoordinates);
        setZones(list);
        setSelected(list[0] || null);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => zones.filter((zone) => {
      const calculation = memorial?.calculation;
      if (calculation?.region && zone.region !== calculation.region) return false;
      if (calculation?.climate && zone.climate !== calculation.climate) return false;
      if (calculation?.water_proximity === "Да" && !zone.near_water) return false;
      return `${zone.name} ${zone.address} ${zone.zone_type} ${zone.region} ${zone.climate}`
        .toLowerCase()
        .includes(query.toLowerCase());
    }),
    [zones, query, memorial],
  );

  useEffect(() => {
    if (selected && !filtered.some((zone) => zone.id === selected.id)) {
      setSelected(filtered[0] || null);
    }
  }, [filtered, selected]);

  const chooseZone = async () => {
    if (!memorial) {
      onCreate();
      return;
    }

    setSaving(true);
    setError("");
    try {
      const planting = await apiRequest("/tracker/plantings/", {
        method: "POST",
        body: {
          calculation: memorial.calculation.id,
          pet: memorial.pet.id,
          tree_species: memorial.calculation.recommended_tree?.id ?? null,
          eco_zone: selected.id,
          planting_date: new Date().toISOString().slice(0, 10),
          location_details: selected.address || selected.name,
        },
      });
      onPlantingCreated(planting);
    } catch (requestError) {
      setError(requestError.message || "Не удалось создать посадку.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="map-page">
      <aside className="zones-panel">
        <div className="zones-heading">
          <span className="eyebrow">ЭКО-ПАРКИ</span>
          <h1>Найдите особое место</h1>
          <p>Выберите парк в заданном регионе. Демонстрационные координаты отмечены отдельно.</p>
        </div>
        <label className="search-field"><Icon name="location" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Район или название парка" /></label>
        <div className="zone-count"><b>{filtered.length} зон</b><span>доступно</span></div>

        <div className="zone-list">
          {loading && [1, 2, 3].map((item) => <div className="zone-card skeleton" key={item} />)}
          {!loading && filtered.length === 0 && (
            <div className="empty-state compact"><span><Icon name="leaf" /></span><h3>{error ? "Не удалось загрузить зоны" : "Места не найдены"}</h3><p>{error || (memorial ? "Нет эко-парков, соответствующих региону, климату и фильтру близости к воде." : zones.length === 0 ? "Добавьте активные эко-зоны с координатами, чтобы они появились на карте." : "Попробуйте изменить запрос.")}</p></div>
          )}
          {!loading && filtered.map((zone) => (
            <button key={zone.id} className={`zone-card ${selected?.id === zone.id ? "selected" : ""}`} onClick={() => setSelected(zone)}>
              <div>
                <span className="zone-icon"><Icon name="sprout" /></span>
                <span>
                  <b>{zone.name}</b>
                  <small><Icon name="pin" size={14} /> {zone.address}</small>
                  <small>{zone.region} · {zone.climate}{zone.near_water ? " · у воды" : ""}</small>
                </span>
              </div>
              <span className="availability">{zone.is_demo ? "Демо" : zone.has_care_service ? "Уход" : "Без ухода"}</span>
              <Icon name="arrow" size={17} />
            </button>
          ))}
        </div>
        {selected && (
          <article className="map-detail">
            <button className="close-detail" onClick={() => setSelected(null)} aria-label="Закрыть"><Icon name="close" size={17} /></button>
            <span className="detail-photo"><span><Icon name="sprout" size={34} /></span></span>
            <div className="detail-content">
              <span className="availability">{selected.zone_type}</span>
              <h2>{selected.name}</h2>
              <p><Icon name="pin" size={15} /> {selected.address}</p>
              <p>Регион: {selected.region || "Не указан"} · климат: {selected.climate || "Не указан"}</p>
              <p>{selected.near_water ? "Рядом есть водоём." : "Зона не отмечена как расположенная рядом с водоёмом."}</p>
              {selected.is_demo && <p className="zone-demo-notice">Демонстрационная точка: координаты приблизительные, доступность места для посадки нужно уточнить.</p>}
              <p>{selected.has_care_service ? "В зоне доступна услуга ухода за саженцами." : "Уход за саженцем не входит в услуги зоны."}</p>
              <p>{selected.rules}</p>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-button full" onClick={chooseZone} disabled={saving}>
                {saving ? <span className="loader" /> : memorial ? "Создать посадку здесь" : "Сначала создать мемориал"}
                {!saving && <Icon name="arrow" />}
              </button>
            </div>
          </article>
        )}
      </aside>

      <section className="map-canvas">
        <MapContainer
          center={defaultCenter}
          zoom={5}
          scrollWheelZoom
          zoomControl={false}
          className="leaflet-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapViewport zones={filtered} selected={selected} />
          <MapZoomControls />
          {filtered.map((zone) => (
            <Marker
              key={zone.id}
              position={[Number(zone.latitude), Number(zone.longitude)]}
              icon={selected?.id === zone.id ? activeMarkerIcon : markerIcon}
              eventHandlers={{ click: () => setSelected(zone) }}
            />
          ))}
        </MapContainer>
      </section>
    </div>
  );
}
