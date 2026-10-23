import { useEffect, useState } from "react";
import { Icon } from "./App";
import { apiRequest } from "./api";
import { calculateAgeAtDeath } from "./dateUtils";
import DatePicker from "./DatePicker";

const initialForm = {
  pet_name: "",
  pet_species: "Кошка",
  pet_breed: "",
  pet_weight: "",
  pet_birth_date: "",
  pet_death_date: "",
  pet_photo: null,
  climate: "Умеренный",
  soil: "Суглинок",
  region: "Московская область",
  lighting: "Частичная тень",
  water_proximity: "Нет",
  care_level_pref: "Минимальный",
  desired_growth_time: "Средний",
  comment: "",
  scenario: "Эко-парк",
};

export default function Calculator({ initialPet, onMap, onCreated, onFinished }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [petRecord, setPetRecord] = useState(initialPet || null);
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!initialPet) return;
    setPetRecord(initialPet);
    setForm((current) => ({
      ...current,
      pet_name: initialPet.name || "",
      pet_species: initialPet.species || "Другое",
      pet_breed: initialPet.breed || "",
      pet_weight: initialPet.weight_kg ?? "",
      pet_birth_date: initialPet.birth_date || "",
      pet_death_date: initialPet.death_date || "",
    }));
  }, [initialPet]);

  useEffect(() => {
    apiRequest("/zones/", { auth: false })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error("Сервер вернул некорректный список регионов.");
        }
        const regionMap = new Map();
        data.forEach((zone) => {
          if (!zone.region || !zone.climate) return;
          if (regionMap.has(zone.region) && regionMap.get(zone.region) !== zone.climate) {
            throw new Error(`Для региона «${zone.region}» указаны разные климатические зоны.`);
          }
          regionMap.set(zone.region, zone.climate);
        });
        const options = [...regionMap.entries()]
          .map(([region, climate]) => ({ region, climate }))
          .sort((left, right) => left.region.localeCompare(right.region, "ru"));
        if (options.length === 0) {
          throw new Error("В каталоге эко-парков пока нет регионов с климатическими зонами.");
        }
        setRegions(options);
        setForm((current) => {
          const selectedRegion = options.find((option) => option.region === current.region) || options[0];
          return {
            ...current,
            region: selectedRegion.region,
            climate: selectedRegion.climate,
          };
        });
      })
      .catch((requestError) => setError(requestError.message || "Не удалось загрузить регионы."))
      .finally(() => setRegionsLoading(false));
  }, []);

  const update = (event) => {
    const { name, value } = event.target;
    if (name === "region") {
      const selectedRegion = regions.find((option) => option.region === value);
      setForm((current) => ({
        ...current,
        region: value,
        climate: selectedRegion?.climate || "",
      }));
      return;
    }
    setForm((current) => ({ ...current, [name]: value }));
  };

  const calculate = async () => {
    if (!form.region.trim()) {
      setError("Укажите регион, чтобы получить рекомендацию.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const petData = new FormData();
      petData.append("name", form.pet_name);
      petData.append("species", form.pet_species);
      petData.append("breed", form.pet_breed);
      petData.append("weight_kg", String(Number(form.pet_weight)));
      if (form.pet_birth_date) petData.append("birth_date", form.pet_birth_date);
      if (form.pet_death_date) petData.append("death_date", form.pet_death_date);
      if (form.pet_photo) petData.append("photo", form.pet_photo);

      const pet = await apiRequest(
        petRecord ? `/calculator/pets/${petRecord.id}/` : "/calculator/pets/",
        {
          method: petRecord ? "PATCH" : "POST",
          body: petData,
        },
      );
      setPetRecord(pet);
      const calculation = await apiRequest("/calculator/calculate/", {
        method: "POST",
        body: {
          weight: Number(form.pet_weight),
          scenario: form.scenario,
          region: form.region,
          climate: form.climate,
          soil: form.soil,
          lighting: form.lighting,
          water_proximity: form.water_proximity,
          care_level_pref: form.care_level_pref,
          desired_growth_time: form.desired_growth_time,
          comment: form.comment,
          pet_id: pet.id,
        },
      });
      setResult(calculation);
      onCreated({ pet, calculation });
    } catch (requestError) {
      setError(requestError.message || "Не удалось сохранить расчёт. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPassport = async () => {
    setDownloading(true);
    setError("");
    try {
      const pdf = await apiRequest(`/calculator/${result.id}/pdf/`);
      const url = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      link.download = `memorial-${result.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message || "Не удалось скачать PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const finishOwnPlotMemorial = async () => {
    if (!result || !petRecord) {
      setError("Не удалось найти питомца или расчёт. Вернитесь к заполнению данных и попробуйте снова.");
      return;
    }

    setFinishing(true);
    setError("");
    try {
      await apiRequest("/tracker/plantings/", {
        method: "POST",
        body: {
          calculation: result.id,
          pet: petRecord.id,
          tree_species: result.recommended_tree?.id ?? null,
          eco_zone: null,
          planting_date: new Date().toISOString().slice(0, 10),
          location_details: "Собственный участок",
        },
      });
      onFinished();
    } catch (requestError) {
      setError(requestError.message || "Не удалось завершить создание мемориала.");
    } finally {
      setFinishing(false);
    }
  };

  if (result) {
    return (
      <div className="page narrow-page">
        <div className="result-hero">
          <span className="result-icon"><Icon name="sprout" size={36} /></span>
          <span className="eyebrow">РЕКОМЕНДАЦИЯ ГОТОВА</span>
          <h1>Живой мемориал для {form.pet_name || "вашего друга"}</h1>
          <p>Мы подобрали экологичное сочетание с учётом климата, почвы и ваших пожеланий.</p>
        </div>
        <div className="recommendation-grid">
          <article className="recommendation-card">
            <span className="card-number">01</span>
            <span className="recommendation-visual capsule-visual"><span /></span>
            <small>БИОКАПСУЛА</small>
            <h2>{result.recommended_capsule_material}</h2>
            <p>Размер: {result.recommended_capsule_size}. Прогнозируемый срок биодеградации: {result.est_degradation_time}.</p>
            {result.degradation_breakdown && <p>
              Формула: {result.degradation_breakdown.base_months} × {result.degradation_breakdown.k_weight} × {result.degradation_breakdown.k_soil} × {result.degradation_breakdown.k_climate} = {result.degradation_breakdown.total_months} мес.
            </p>}
            <ul><li><Icon name="check" /> Биоразлагаемый материал</li><li><Icon name="check" /> Учтены вес, почва и климат</li></ul>
          </article>
          <article className="recommendation-card featured">
            <span className="card-number">02</span>
            <span className="recommendation-visual tree-visual"><Icon name="sprout" size={60} /></span>
            <small>ДЕРЕВО</small>
            <h2>{result.recommended_tree?.title || "Подходящая порода не найдена"}</h2>
            <p>{result.recommended_tree ? `Климат: ${result.recommended_tree.recommended_climate}. Подходящие почвы: ${result.recommended_tree.recommended_soil}.` : "Посмотрите каталог пород и уточните климатические условия."}</p>
            {result.recommended_tree && <ul><li><Icon name="check" /> Темп роста: {result.recommended_tree.growth_rate}</li><li><Icon name="check" /> Уход: {result.recommended_tree.care_level}</li></ul>}
          </article>
        </div>
        <div className="result-actions">
          <button className="secondary-button" onClick={downloadPassport} disabled={downloading}>{downloading ? <span className="loader" /> : <Icon name="download" />} Скачать PDF</button>
          {form.scenario === "Собственный участок" ? (
            <button className="primary-button" onClick={finishOwnPlotMemorial} disabled={finishing}>
              {finishing ? <span className="loader" /> : "Завершить создание"}
              {!finishing && <Icon name="arrow" />}
            </button>
          ) : (
            <button className="primary-button" onClick={onMap}>Выбрать место <Icon name="arrow" /></button>
          )}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="text-button centered" onClick={() => { setResult(null); setStep(1); }}><Icon name="back" /> Изменить параметры</button>
      </div>
    );
  }

  return (
    <div className="page calculator-page">
      <header className="page-heading centered-heading">
        <span className="eyebrow">СОЗДАЙТЕ ЖИВОЙ МЕМОРИАЛ</span>
        <h1>Начнём с маленькой истории</h1>
        <p>Ответьте на несколько вопросов — мы подберём экологичное и подходящее решение.</p>
      </header>

      <div className="stepper">
        {["О питомце", "Условия", "Ваш выбор"].map((label, index) => (
          <div key={label} className={step >= index + 1 ? "active" : ""}>
            <span>{step > index + 1 ? <Icon name="check" size={16} /> : index + 1}</span><b>{label}</b>
          </div>
        ))}
      </div>

      <section className="form-card">
        <div className="form-card-heading">
          <span className="soft-icon"><Icon name={step === 1 ? "leaf" : step === 2 ? "location" : "sprout"} /></span>
          <div><small>ШАГ {step} ИЗ 3</small><h2>{step === 1 ? "Расскажите о питомце" : step === 2 ? "Где будет расти дерево?" : "Какой мемориал вы представляете?"}</h2></div>
        </div>

        {step === 1 && initialPet && (
          <p className="existing-pet-notice">
            Создаём мемориал для питомца «{initialPet.name}». Данные карточки можно изменить перед расчётом.
          </p>
        )}
        {step === 1 && (
          <div className="form-grid">
            <label>Имя питомца<input name="pet_name" value={form.pet_name} onChange={update} placeholder="Например, Боня" required /></label>
            <label>Вид питомца<select name="pet_species" value={form.pet_species} onChange={update}><option>Кошка</option><option>Собака</option><option>Грызун</option><option>Птица</option><option>Другое</option></select></label>
            <label>Порода<input name="pet_breed" value={form.pet_breed} onChange={update} placeholder="Например, метис" /></label>
            <label>Вес питомца, кг<input type="number" min="0.1" name="pet_weight" value={form.pet_weight} onChange={update} placeholder="Например, 8" required /></label>
            <label>Дата рождения<DatePicker name="pet_birth_date" value={form.pet_birth_date} onChange={update} /></label>
            <label>Дата ухода<DatePicker name="pet_death_date" value={form.pet_death_date} onChange={update} /></label>
            <label>Возраст на дату ухода, лет<input value={calculateAgeAtDeath(form.pet_birth_date, form.pet_death_date)} readOnly placeholder="Укажите обе даты" /></label>
            <label className="upload-field pet-photo-upload">
              <input type="file" accept="image/*" onChange={(event) => setForm({ ...form, pet_photo: event.target.files?.[0] || null })} />
              <Icon name="upload" />
              <span><b>{form.pet_photo ? form.pet_photo.name : "Добавить фото питомца"}</b><small>JPG или PNG до 10 МБ</small></span>
            </label>
          </div>
        )}
        {step === 2 && (
          <div className="form-grid">
            <label>Регион<select name="region" value={form.region} onChange={update} required disabled={regionsLoading || regions.length === 0}>
              {regions.map((option) => <option key={option.region} value={option.region}>{option.region}</option>)}
            </select></label>
            <label>Климатическая зона<input value={form.climate} readOnly placeholder={regionsLoading ? "Загружаем климатические зоны…" : ""} /></label>
            <label>Тип почвы<select name="soil" value={form.soil} onChange={update}><option>Суглинок</option><option>Песчаная</option><option>Чернозём</option><option>Глинистая</option></select></label>
            <label>Освещённость<select name="lighting" value={form.lighting} onChange={update}><option>Частичная тень</option><option>Солнечное место</option><option>Тень</option></select></label>
            <label>Рядом есть водоём?<select name="water_proximity" value={form.water_proximity} onChange={update}><option>Нет</option><option>Да</option></select></label>
            <label>Предпочтительный уровень ухода<select name="care_level_pref" value={form.care_level_pref} onChange={update}><option>Минимальный</option><option>Средний</option><option>Высокий</option></select></label>
            <label>Желаемый темп роста<select name="desired_growth_time" value={form.desired_growth_time} onChange={update}><option>Медленный</option><option>Средний</option><option>Быстрый</option></select></label>
            <label className="wide-field">Комментарий<textarea name="comment" value={form.comment} onChange={update} rows="3" placeholder="Дополнительные пожелания к мемориалу" /></label>
            {regionsLoading && <p className="field-hint">Загружаем регионы и климатические зоны…</p>}
            {!regionsLoading && regions.length === 0 && <p className="form-error" role="alert">{error || "Нет доступных регионов. Проверьте каталог эко-парков."}</p>}
          </div>
        )}
        {step === 3 && (
          <div className="choice-grid">
            {["Эко-парк", "Собственный участок"].map((choice) => (
              <button key={choice} className={form.scenario === choice ? "selected" : ""} onClick={() => setForm({ ...form, scenario: choice })}>
                <span><Icon name={choice === "Эко-парк" ? "sprout" : choice === "Собственный участок" ? "home" : "leaf"} /></span>
                <b>{choice}</b><small>{choice === "Эко-парк" ? "Уход специалистов" : choice === "Собственный участок" ? "Всегда рядом с домом" : "В гармонии с природой"}</small>
              </button>
            ))}
          </div>
        )}

        <div className="form-navigation">
          <button className="text-button" disabled={step === 1} onClick={() => setStep(step - 1)}><Icon name="back" /> Назад</button>
          {step < 3 ? (
            <button className="primary-button" onClick={() => setStep(step + 1)} disabled={(step === 1 && (!form.pet_name || !form.pet_weight)) || (step === 2 && (regionsLoading || !form.region || !form.climate))}>Продолжить <Icon name="arrow" /></button>
          ) : (
            <button className="primary-button" onClick={calculate} disabled={loading}>{loading ? <span className="loader" /> : "Получить рекомендацию"} {!loading && <Icon name="arrow" />}</button>
          )}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
      <p className="privacy-note">Ваши данные используются только для расчёта рекомендации.</p>
    </div>
  );
}
