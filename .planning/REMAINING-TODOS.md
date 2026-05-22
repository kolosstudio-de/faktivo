# Faktivo — оставшиеся крупные задачи

Эти 4 пункта из аудита 2026-05-22 требуют большого refactor'а и/или
инфраструктурной работы, поэтому намеренно оставлены вне текущей серии atomic-фиксов.

Все они задокументированы здесь, чтобы не были забыты и чтобы каждый
имел понятный план реализации.

---

## TODO 1 — Money: `Cents = number` → `bigint`

**Severity:** Critical (architecture)
**Effort:** L (2-3 дня)

### Проблема
В [src/lib/money.ts:8](../src/lib/money.ts) тип `Cents = number`. Все
финансовые поля DB объявлены `bigint`, но `supabase-js` возвращает их
как JS `number` — точно до `2^53 - 1` (≈ 9 квадриллионов центов, или
~90 трлн €). Для типичного юзера безопасно, но архитектурно противоречит
заявленному принципу "bigint cents".

### Что нужно сделать
1. `type Cents = bigint` в [src/lib/money.ts](../src/lib/money.ts).
2. Все арифметические операции переписать на bigint:
   - `quantity * unitPriceCents` → нужно `BigInt(quantity)` если qty — int;
     если qty с decimals, использовать промежуточно scaled int (например ×1000).
3. Преобразование при сериализации:
   - `JSON.stringify` не сериализует bigint — нужен `replacer` или
     custom serializer.
   - Все API route returns: преобразовать `cents` в string или в Number
     для front-end.
4. `react-hook-form` поля — `unit_price_cents` сейчас `number`, надо
   перевести валидаторы Zod на `z.coerce.bigint()`.
5. PDF generators, EÜR агрегаты, charts (Recharts требует Number для оси Y) —
   conversion-point в каждом consumer'е.
6. Тесты в [scripts/test-money.mjs](../scripts/test-money.mjs) обновить.

### Минимальный путь сейчас
Оставить `Cents = number` пока. Установить инвариант: ни одно поле
не должно превышать `Number.MAX_SAFE_INTEGER / 100` (=
`90,071,992,547,409.91 €`). Добавить runtime-проверку в `roundHalfUp`
и логировать в Sentry если близко.

---

## TODO 2 — Steuerberater-ZIP streaming

**Severity:** Medium (operational)
**Effort:** M (1-2 дня)

### Проблема
[src/app/api/export/steuerberater-zip/route.ts](../src/app/api/export/steuerberater-zip/route.ts)
использует JSZip который держит весь ZIP в памяти. При экспорте годового
архива (1000+ PDF + DATEV CSV + XRechnung XML + audit log) ZIP может
быть 100-500 MB → Vercel 60s timeout + 1 GB memory limit взорвутся.

### Что нужно сделать
1. Заменить `jszip` на `archiver` (Node.js streaming).
2. Endpoint вернуть `ReadableStream` через `new Response(stream, ...)`.
3. На клиенте — обычный `<a href download>` работает с streaming response.
4. Опционально: pre-flight HEAD request чтобы оценить размер; если > 100 MB —
   делать через background job (см. TODO 3) и присылать email с download-link.
5. Если archiver не подходит — рассмотреть `tar-stream` или Cloudflare R2
   pre-signed multipart upload.

### Зависимости
- Memory limit Vercel 2025: 3 GB на Pro, 1 GB на Hobby
- `archiver` не tree-shake'ает хорошо — bundle +500 KB

---

## TODO 3 — Background job queue

**Severity:** Medium (UX)
**Effort:** L (2-3 дня)

### Проблема
- `/api/banking/sync` и `/api/banking/materialize-all` могут long-running
  (TrueLayer pagination + 50+ accounts).
- `/api/export/steuerberater-zip` — см. TODO 2.
- `/api/cron/reminders` — массовая рассылка emails.

Сейчас всё inline в request handler с `maxDuration = 60` (Vercel). При
росте — timeout.

### Что нужно сделать
Вариант A — Supabase pg_cron + DB queue table:
1. Таблица `job_queue (id, kind, payload_jsonb, status, attempts, created_at, …)`.
2. pg_cron job каждые 30 сек: SELECT FOR UPDATE SKIP LOCKED first row,
   запускает RPC `process_job(id)`.
3. Route handler INSERT'ит в job_queue и возвращает `{ job_id }` →
   клиент polling'ует `/api/jobs/{id}` или подписан на realtime.

Вариант B — Inngest / Trigger.dev:
- SaaS, free tier на 50k events/мес.
- Простой setup, retry-логика встроена.

Вариант C — Vercel Cron + DB queue:
- pg_cron не нужен, всё на vercel.json crons schedule.

### Рекомендуется
Вариант A — нулевая внешняя зависимость, всё внутри Supabase.

---

## TODO 4 — EKS period boundary test

**Severity:** Low (regression detection)
**Effort:** S (несколько часов)

### Проблема
[scripts/eks-vergleich-test.mjs](../scripts/eks-vergleich-test.mjs) от
21 мая — последний след работы перед моим аудитом. Скорее всего там
расхождения EKS vorläufig vs endgültig из-за timezone/округлений.

### Что нужно сделать
1. Прогнать `node scripts/eks-vergleich-test.mjs` на свежей DB
   (с уже применёнными миграциями 20260522…).
2. Где расходятся — добавить assertion и логировать diff в Sentry.
3. Превратить в vitest / playwright suite чтобы catch'ить regression'ы.
4. Backfill: для существующих jobcenter_reports пересчитать с правильной
   Berlin tz и сравнить.

---

## Карта приоритетов

| Когда | Делать |
|---|---|
| До production launch | TODO 1 (money type) — runtime guard минимум |
| После 100+ юзеров | TODO 2 (streaming) — годовой экспорт начнёт ломаться |
| После 1000+ юзеров | TODO 3 (job queue) — banking sync будет timeout'ить |
| Перед налоговой проверкой | TODO 4 (EKS test) — compliance regression catch |
