import type { LegalForm } from "@/types/database.types"

export interface LegalFormEntry {
  value: LegalForm
  label: string
  labelRu: string
  labelUa: string
  description: string
  descriptionRu: string
  descriptionUa: string
  emoji: string
  requiresHandelsregister?: boolean
}

export const legalForms: LegalFormEntry[] = [
  {
    value: "freiberufler",
    label: "Freiberufler:in",
    labelRu: "Фрилансер (Freiberufler)",
    labelUa: "Фрилансер (Freiberufler)",
    description:
      "Designer:in, Entwickler:in, Journalist:in, Therapeut:in, Übersetzer:in …",
    descriptionRu: "Дизайнер, разработчик, журналист, терапевт, переводчик …",
    descriptionUa: "Дизайнер, розробник, журналіст, терапевт, перекладач …",
    emoji: "🧑‍💼",
  },
  {
    value: "einzelunternehmen",
    label: "Einzelunternehmen",
    labelRu: "ИП (Einzelunternehmen)",
    labelUa: "ФОП (Einzelunternehmen)",
    description: "Gewerbe / Handwerk / Handel als Einzelperson angemeldet.",
    descriptionRu: "Зарегистрированный Gewerbe на одно лицо.",
    descriptionUa: "Зареєстрований Gewerbe на одну особу.",
    emoji: "🏪",
  },
  {
    value: "gbr",
    label: "GbR",
    labelRu: "GbR (товарищество)",
    labelUa: "GbR (товариство)",
    description: "Gesellschaft bürgerlichen Rechts — 2+ Personen, einfache Form.",
    descriptionRu: "Простое товарищество из 2+ человек.",
    descriptionUa: "Просте товариство з 2+ осіб.",
    emoji: "👥",
  },
  {
    value: "ug",
    label: "UG (haftungsbeschränkt)",
    labelRu: "UG (ООО с мин. капиталом)",
    labelUa: "UG (ТОВ з мін. капіталом)",
    description: "Mini-GmbH mit 1 € Stammkapital — Handelsregister-pflichtig.",
    descriptionRu: "Mini-GmbH, 1€ уставного капитала.",
    descriptionUa: "Mini-GmbH, 1€ статутного капіталу.",
    emoji: "🏢",
    requiresHandelsregister: true,
  },
  {
    value: "gmbh",
    label: "GmbH",
    labelRu: "GmbH",
    labelUa: "GmbH",
    description: "25.000 € Stammkapital. Handelsregister-pflichtig.",
    descriptionRu: "Уставной капитал 25.000 €.",
    descriptionUa: "Статутний капітал 25.000 €.",
    emoji: "🏛️",
    requiresHandelsregister: true,
  },
  {
    value: "kuenstler",
    label: "Künstler / Publizist (KSK-pflichtig)",
    labelRu: "Художник / публицист (KSK)",
    labelUa: "Митець / публіцист (KSK)",
    description: "Musiker, Schriftsteller, Maler, freier Journalist …",
    descriptionRu: "Музыкант, писатель, художник, свободный журналист …",
    descriptionUa: "Музикант, письменник, митець, вільний журналіст …",
    emoji: "🎭",
  },
  {
    value: "kg",
    label: "KG / OHG",
    labelRu: "KG / OHG (товарищества)",
    labelUa: "KG / OHG (товариства)",
    description: "Personengesellschaft mit Komplementär + Kommanditist.",
    descriptionRu: "Товарищество с полным и ограниченным партнёром.",
    descriptionUa: "Товариство з повним та обмеженим партнером.",
    emoji: "🤝",
    requiresHandelsregister: true,
  },
  {
    value: "andere",
    label: "Andere",
    labelRu: "Другое",
    labelUa: "Інше",
    description: "Kannst du später in den Einstellungen ändern.",
    descriptionRu: "Можно изменить позже в настройках.",
    descriptionUa: "Можна змінити пізніше в налаштуваннях.",
    emoji: "⛰️",
  },
]
