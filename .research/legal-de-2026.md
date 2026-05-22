# Legal Compliance Checklist: German SaaS Invoicing/Finance (2026–2030)

> **Scope**: Comprehensive compliance blueprint for a SaaS invoicing/finance product aimed at German freelancers (`Einzelunternehmer`, `Freiberufler`) and small businesses — specifically a small media agency persona.
>
> **Status**: As of April 2026. Explicitly flags what CHANGED 2024–2025 and what is COMING 2026–2028.
>
> **Sources note**: Citations are to original German legal text (`Gesetze im Internet`), BMF letters (`BMF-Schreiben`), and official BMF/KoSIT/FeRD publications. Web fetch was not available in this research session — all references are to primary sources the reader can verify. Where BMF numbers are quoted, they are the binding reference.
>
> **Reading order for the product owner**: Section 2 (E-Rechnung), Section 3 (GoBD), Section 1 (UStG) are the three existential/DEALBREAKER areas. Section 5 (Bürgergeld/EKS) is the MOAT — no German competitor does it well. Others are table stakes.

---

## TL;DR — Dealbreakers & Deadlines

| Deadline | Requirement | Who it hits |
|---|---|---|
| **2025-01-01** | Every B2B invoice recipient **MUST be able to receive** a structured E-Rechnung (XRechnung/ZUGFeRD 2.x with CII). A plain PDF is no longer an "E-Rechnung" in the legal sense. | Every business recipient |
| **2025-01-01** | Kleinunternehmer thresholds raised: **€25,000 prior year / €100,000 current year** (replaces €22k / €50k). §19 UStG redrafted. | All Kleinunternehmer |
| **2025-01-01** | Kleinunternehmer revenue is now **steuerfrei** (not merely "not levied"). New invoice-notice wording required. | All Kleinunternehmer |
| **2025-01-01** | New Kleinunternehmer e-invoicing exemption: may still send PDF/"sonstige Rechnung" — but must **receive** structured. | All Kleinunternehmer |
| **2026-12-31** | End of transition: `sonstige Rechnungen` (PDF, paper) are still allowed for B2B **by consent of the recipient**. | Senders |
| **2027-01-01** | Sending E-Rechnung mandatory for companies with **prior-year turnover > €800,000**. | Mid/larger businesses |
| **2028-01-01** | E-Rechnung **mandatory for ALL B2B senders** in DE, regardless of turnover. | Every B2B invoice sender |
| **2025-01-01** | GoBD (2019/2024 revision) in full force: unveränderbare Speicherung + Verfahrensdokumentation + Datenträgerüberlassung (Z3). | Every bookkeeper |
| **Ongoing** | 8-year retention for invoices (reduced from 10 years by the **Bürokratieentlastungsgesetz IV**, effective 2025). Contracts & bookkeeping records also 8 years. | Every business |

> **GOTCHA #1**: Many articles still cite **10-year retention for invoices**. WRONG since 2025. Bürokratieentlastungsgesetz IV (BGBl. I 2024 Nr. 323) reduced `Handels- und Geschäftsbriefe` and `Buchungsbelege` (incl. invoices) retention from 10 → 8 years for records where the retention period has not yet expired on 31.12.2024. This is a MOAT for SaaS: your tooltip should explicitly say "8 Jahre (seit BEG IV)".
>
> **GOTCHA #2**: The "email with PDF = valid invoice" era is ending. Until 2026-12-31 it's still legal to send PDFs *by consent*, but your recipient must already be technically capable of receiving an E-Rechnung (CII-XML). If you market to agency owners receiving invoices from freelancers, they already need a way to ingest XML.
>
> **GOTCHA #3**: Kleinunternehmer invoices MUST NOT show VAT. Wrong wording = §14c liability (you owe the tax even though you invoiced wrongly).
>
> **GOTCHA #4**: Sequential invoice numbering must be **lückenlos** (gap-free) per numbering circle. Deleted/voided numbers must be **documented** — you can't just skip. Typical product bug: allow user to delete a draft invoice that already burned a number.

---

## 1. Invoice Requirements (§14 UStG, §14a UStG)

### 1.1 Mandatory Fields — §14 Abs. 4 UStG

Every invoice (except Kleinbetragsrechnung, see 1.4) must contain these fields. Wording matters — tax auditors and recipients' Vorsteuerabzug depend on it.

1. **Vollständiger Name und Anschrift** des leistenden Unternehmers (seller) **und** Leistungsempfängers (buyer). Full legal name, full postal address. `c/o` is acceptable only if also resolvable.
2. **Steuernummer** des leistenden Unternehmers **ODER** die vom BZSt erteilte **Umsatzsteuer-Identifikationsnummer** (USt-IdNr., format `DE` + 9 digits). Note: If the invoice relates to intra-EU B2B service under §13b, USt-IdNr. is mandatory (for both parties).
3. **Ausstellungsdatum** (issue date of the invoice).
4. **Fortlaufende Rechnungsnummer** (sequential invoice number — "einmalig vergeben, lückenlos"). See 1.3.
5. **Menge und Art (handelsübliche Bezeichnung)** der gelieferten Gegenstände oder Art und Umfang der Leistung.
6. **Zeitpunkt der Lieferung oder sonstigen Leistung** (performance date). If same as invoice date, still must be stated: `"Leistungsdatum entspricht dem Rechnungsdatum"` is an acceptable formulation — BFH ruling V R 42/08.
7. **Nach Steuersätzen und einzelnen Steuerbefreiungen aufgeschlüsseltes Entgelt** (net amount, broken down per VAT rate). Include any **im Voraus vereinbarte Minderungen** (Skonto, Rabatt).
8. **Anzuwendender Steuersatz** (VAT rate: 19%, 7%, or 0% with explicit reason) **und** der auf das Entgelt entfallende Steuerbetrag (VAT amount per rate).
   - In case of `Steuerbefreiung`: a **Hinweis auf die Steuerbefreiung** — e.g., `"Steuerfreie innergemeinschaftliche Lieferung gem. §4 Nr. 1b i.V.m. §6a UStG"` or `"Reverse Charge: Steuerschuldnerschaft des Leistungsempfängers gem. §13b UStG"` (exact wording per §14 Abs. 4 Nr. 10 UStG).
9. **Steuerschuldnerschaft des Leistungsempfängers** — if applicable (Reverse Charge), the invoice must explicitly say: `"Steuerschuldnerschaft des Leistungsempfängers"`. Since 2013 this exact wording is required (§14a Abs. 5 UStG).
10. **Hinweis auf die Aufbewahrungspflicht** — for B2C work on buildings (§14b Abs. 1 S. 5 UStG): `"Der Empfänger ist verpflichtet, diese Rechnung zwei Jahre aufzubewahren."` (relevant for agency billing a private customer for, e.g., a home studio installation.)

### 1.2 Additional fields in special cases — §14a UStG

- **Innergemeinschaftliche Lieferung** (§14a Abs. 3): USt-IdNr. of seller + buyer, `"Steuerfreie innergemeinschaftliche Lieferung"`.
- **Innergemeinschaftliche Dienstleistung B2B** (§14a Abs. 1): USt-IdNr. of both, `"Steuerschuldnerschaft des Leistungsempfängers"`.
- **Reiseleistungen §25** or **Differenzbesteuerung §25a**: corresponding notice mandatory (e.g., `"Gebrauchtgegenstände / Sonderregelung"`).
- **Gutschrift** (credit-billing / self-billing where the recipient issues the invoice): word `"Gutschrift"` MUST appear on the document. Since 2013. Different meaning from the colloquial "Gutschrift = credit note"! This is a common source of §14c liability.

### 1.3 Sequential Numbering — the "lückenlos" rule

- §14 Abs. 4 Nr. 4 UStG requires **einmalige, fortlaufende** numbers.
- "Fortlaufend" means: **no unexplained gaps**. BUT: you may use **multiple number circles** (e.g., `2026-RE-00001` for invoices, `2026-GS-00001` for credit notes, per branch, per customer group) **provided the circle scheme itself is consistent and documented**.
- Acceptable formats: numeric (`00001`), alphanumeric (`2026-001`), with prefix per year/series. No specific format is prescribed by UStG.
- **Deletion is forbidden** once an invoice was "issued" (i.e., dispatched to recipient). If a draft burns a number and is never sent, the gap must be documented in your bookkeeping (e.g., `"Nr. 2026-045 — storniert vor Versand"`). This is a **GoBD matter** (Unveränderbarkeit).
- **Product rule of thumb**: never delete invoice numbers in your DB. Use a `status: draft | issued | cancelled` flag. Never recycle a number.

### 1.4 Kleinbetragsrechnung — §33 UStDV

For invoices **up to €250 gross (Bruttobetrag)** (threshold raised from €150 by Bürokratieentlastungsgesetz II, 2017), a simplified form is allowed:

Mandatory fields (only 5):
1. Name and address of **issuer** (not recipient).
2. Date.
3. Menge/Art der Lieferung/Leistung.
4. **Entgelt und Steuerbetrag in einer Summe** (gross amount may be a single sum).
5. Steuersatz or reason for Steuerbefreiung.

No invoice number required, no recipient required. Useful for receipts in the UI (e.g., a client walking in and paying cash for a quick design service).

### 1.5 Kleinunternehmer §19 UStG — 2025 changes (MAJOR)

**Prior to 2025** (€22,000 / €50,000 thresholds):
- §19 UStG treated Kleinunternehmer as "Umsatzsteuer wird nicht erhoben" (USt is not levied — technically: still fällig but not collected).
- Threshold: prior year ≤ €22,000 **AND** current year planned ≤ €50,000.

**From 2025-01-01** (**Jahressteuergesetz 2024**, BGBl. I 2024 Nr. 387, Art. 28):
- New thresholds: **prior year ≤ €25,000** AND **current year ≤ €100,000** (§19 Abs. 1 UStG). NOTE: the €100,000 is a **hard cap within the year** — the moment you cross it, you **immediately lose Kleinunternehmer status** for the remainder of the year for the invoice that crosses the threshold (retroactive-in-year to that invoice). This is new. Before, you kept status for the full year even if you exceeded €50k planned.
- Kleinunternehmer revenue is now **steuerfrei** (a real §4 exemption), not merely "nicht erhoben" — this has knock-on effects: **no VAT on invoices, no Vorsteuerabzug, no UStVA filing** (you may still need to file a ZM for intra-EU supplies of services).

**Mandatory invoice notice (from 2025)**:

> **"Rechnung ohne ausgewiesene Umsatzsteuer. Als Kleinunternehmer wird gemäß § 19 UStG keine Umsatzsteuer erhoben."**

Or the newer wording reflecting the steuerfrei characterization:

> **"Kein Steuerausweis aufgrund Anwendung der Kleinunternehmerregelung nach § 19 UStG."**

Either is accepted; the first is more traditional, the second reflects the new §19 wording. **Required on every invoice from a Kleinunternehmer.**

**Never show VAT on a Kleinunternehmer invoice.** If you do, §14c Abs. 2 UStG kicks in: you owe the VAT to the Finanzamt even though you invoiced wrongly (see 1.7).

**Kleinunternehmer & E-Rechnung**: Kleinunternehmer are **exempted from the obligation to SEND E-Rechnungen** (§34a UStDV new, via Jahressteuergesetz 2024). They **still must be able to RECEIVE** E-Rechnungen from 2025-01-01. Critical UX: flag Kleinunternehmer status in the onboarding and default them to "PDF-Versand" while offering e-invoice inbox.

**ID for Kleinunternehmer — new: "Kleinunternehmer-Identifikationsnummer" (KU-ID)**: if a Kleinunternehmer supplies cross-border B2B services within EU using the new §19a Kleinunternehmer-EU scheme, a `EX`-prefixed KU-ID is issued. Low volume but worth implementing opt-in.

### 1.6 Reverse Charge — §13b UStG

Relevant §13b scenarios for a media agency SaaS:

| Scenario | Trigger | Invoice wording |
|---|---|---|
| B2B sonstige Leistung at EU business (§3a Abs. 2) | Recipient is a EU business; service at recipient's country | `"Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge)"` |
| Service from/to non-EU business | Same | Same |
| Bauleistungen an Bauleistenden (§13b Abs. 2 Nr. 4) | Both parties sind Bauleistende | Same + check on counter-party's "Freistellungsbescheinigung nach §48b EStG" |
| Gebäudereinigung (§13b Abs. 2 Nr. 8) | Agency receives cleaning for studio from another Gebäudereiniger | Same |
| Werbeleistungen digitaler Art (ad exchanges — rare for small agencies) | — | — |

**Invoice requirements under §13b**:
- No VAT amount (because recipient owes it).
- USt-IdNr. of **both** parties (not just one) — §14a Abs. 1.
- Clear, exact wording: `"Steuerschuldnerschaft des Leistungsempfängers"` — not paraphrased.
- Recipient pays VAT in their UStVA (declare gross, declare Vorsteuer in same period → net-neutral).

**Product rule**: When invoice total currency ≠ EUR or recipient country ≠ DE, trigger a wizard: "Is recipient a business (has USt-IdNr.)? → Apply Reverse Charge template." Validate USt-IdNr. live against the **BZSt qualifizierte Bestätigung** (web service, SOAP) — a **MOAT feature** because lazy tools just do the format check.

### 1.7 §14c UStG — Unrichtiger / unberechtigter Steuerausweis

- **§14c Abs. 1** — "unrichtiger Steuerausweis": Unternehmer shows higher VAT than legally required → owes the excess. Correctable by invoice correction (after recipient has claimed Vorsteuer, also needs a **correction invoice referencing the original**).
- **§14c Abs. 2** — "unberechtigter Steuerausweis": Person is not a Unternehmer OR Kleinunternehmer who shows VAT → owes the VAT, correction is much harder (requires action to ensure no Vorsteuerabzug by recipient).
- **BFH & EuGH relief (C-378/21, "P GmbH", 2022; BMF-Schreiben 2024-10-27)**: In B2C cases where the recipient could never have deducted Vorsteuer, §14c liability may not apply. But the burden is on the issuer to prove it.

**Product impact**: Make it IMPOSSIBLE for a flagged Kleinunternehmer to accidentally emit an invoice with VAT. Hard block + explainer modal.

### 1.8 Storno / credit notes — correct handling

- **"Storno" is not a legal term** — it's bookkeeping slang.
- Correct way to cancel a dispatched invoice: **issue a new invoice with the negative amount**, clearly referencing the original invoice number. It's a new document with its own sequential number (own Rechnungsnummer from the same circle OR a dedicated `ST-` circle). Invoice date is today, not the original.
- Fields: all §14 fields apply. Text: `"Stornorechnung zu Rechnung Nr. 2026-00123 vom 01.03.2026"`.
- The original invoice stays in the books with status `"storniert am ..."`. You do NOT delete it.
- **Distinguish**:
  - **Stornorechnung**: cancels an earlier invoice.
  - **Korrekturrechnung**: corrects errors (new full invoice + reference).
  - **(kaufmännische) Gutschrift**: reduces a receivable (e.g., for discount after-the-fact). The word `"Gutschrift"` on such a document may be confusingly interpreted as self-billing Gutschrift (§14 UStG). Best practice: write `"Rechnungskorrektur"` or `"Kaufmännische Gutschrift (keine Gutschrift i.S.d. §14 UStG)"` to avoid §14c surprises.
- **Vorsteuer timing**: When Korrekturrechnung is issued, Vorsteuer correction at recipient happens in the period of receipt of the correction (§17 UStG).

**Product rule**: Provide a "Storno" button that generates a new, correctly-typed invoice (never edits the original).

### 1.9 Rechnungspflicht — when MUST I issue an invoice?

- **B2B**: within **6 months** after completion of the supply or service (§14 Abs. 2 S. 2 UStG).
- **B2C for work on buildings/real estate** (building trades): also within 6 months.
- **Other B2C**: no statutory obligation (but strongly advised). Note: reservation — from a Kleinunternehmer POV, an invoice always makes sense for AO-Grundsätze.

---

## 2. E-Rechnung Mandate — The 2025–2028 Transition (CRITICAL)

### 2.1 Legal basis

- **Wachstumschancengesetz** (BGBl. I 2024 Nr. 108, 27.03.2024), introducing changes to §14 UStG.
- **BMF-Schreiben vom 15.10.2024** — GZ III C 2 - S 7287-a/23/10001 :007 — the BMF interpretation letter. This is the **bible** for developers. Updated 2024-12-09 Amtshilfe / clarifications.
- **EU VAT in the Digital Age (ViDA)** proposal — adopted **2025-03-11** — converges to EU-wide e-invoicing + digital reporting by **2030** (intra-EU B2B). Germany is pre-aligning.

### 2.2 Definitions — what IS an E-Rechnung?

Per the new §14 Abs. 1 UStG (effective 2025-01-01):

> An E-Rechnung is an invoice that is issued, transmitted and received in a **structured electronic format**, permitting **electronic processing**, and that complies with **EN 16931** (CEN European Standard for E-Invoicing).

- **EN 16931** defines the semantic model (BT- / BG- codes, business terms & groups).
- Syntaxes permitted in Germany by BMF: **UN/CEFACT Cross Industry Invoice (CII)** and **UBL 2.x (UN/OASIS)**. UBL is rarely used in DE but legal.
- **Formats that qualify**:
  - **XRechnung** (KoSIT specification, currently v3.0.2 as of 2025-01-01, targeted Jan 2026 update): pure CII-XML or UBL-XML. German public-sector standard. Mandatory for invoicing public authorities (already since 2020).
  - **ZUGFeRD 2.x** (FeRD spec, minimum **Profile EN 16931 / "Comfort"**), technically a **hybrid** format: a PDF/A-3 with an embedded CII-XML file named `factur-x.xml` or `zugferd-invoice.xml`. Profiles **"Minimum"** and **"Basic WL"** do NOT qualify as EN 16931 — too reduced — so **not legal** as E-Rechnung for the mandate. **Profile EN 16931 (Comfort)**, **Extended**, and **XRechnung** (ZUGFeRD 2.2+ has an XRechnung-compliant profile) are legal.
  - **Factur-X** (FR equivalent of ZUGFeRD) — identical technical spec.
- **Formats that DO NOT qualify** (post-transition):
  - **Plain PDF** (no embedded XML).
  - **Image/scan** (JPEG, TIFF).
  - **HTML email invoice**.
  - **Word/Excel**.
  - Each of these is now called a **"sonstige Rechnung"**. Legal only during transition and only with recipient consent.

### 2.3 Timeline — the only table you need (pin this)

| From | What is mandatory | What is still allowed |
|---|---|---|
| **2025-01-01** | **Receiving** a structured E-Rechnung (CII-XML / UBL, incl. ZUGFeRD ≥ EN 16931 or XRechnung) must be possible **for every B2B recipient in DE**. No consent needed to send one. | Sending `sonstige Rechnungen` (PDF, paper) remains legal **with recipient's consent** (any prior agreement, incl. implicit). |
| **2025-01-01 – 2026-12-31** | Same — receiving side obligation live; senders choose. | Consent-based PDF/paper still legal. |
| **2027-01-01 – 2027-12-31** | Senders with **prior-year total revenue > €800,000** MUST send E-Rechnung to B2B DE counter-parties. | Senders ≤ €800k still may send PDF with consent; **EDI formats** permitted until 2027-12-31 with consent. |
| **2028-01-01** | **ALL B2B senders** MUST send E-Rechnung (no turnover exemption). | Only E-Rechnung (or EDI-format that fully complies with EN 16931 — essentially no loophole). |
| **2028+** | The next step — ViDA / Digitale Meldepflicht — extending to near-real-time transaction reporting (EU plan: 2030). DE is expected to layer a **Digitale Meldepflicht (DMP)** on top, details TBD. | — |

### 2.4 Scope

**Covered**:
- **B2B, both parties domiciled in Germany** (Sitz, Geschäftsleitung, Betriebsstätte in DE, or gewöhnlicher Aufenthalt).
- All invoice amounts (no minimum, no maximum).

**NOT covered by the mandate**:
- **B2C invoices** (to private customers). Still PDF/paper OK. The customer has no capability requirement. But: if the agency customer is a freelancer acting as business, it's B2B even if they have no GmbH.
- **Kleinbetragsrechnungen ≤ €250** (§33 UStDV) — exempt from the e-invoice obligation (per BMF 15.10.2024). May still be sent as PDF.
- **Fahrausweise** (§34 UStDV) — tickets.
- **Invoices in steuerfreie Leistungen nach §4 Nr. 8–29 UStG** (finance, insurance, health — exempt activities).
- **Foreign recipients** (B2B): outside the DE mandate; ViDA for EU from 2030.
- **Kleinunternehmer** (sending): exempt from sending — may send PDF (but must receive structured, see above).

### 2.5 Technical requirements — what the SaaS actually implements

#### 2.5.1 Schemas/formats to support (minimum viable)

1. **XRechnung 3.x** (KoSIT validation): CII or UBL, with `BuyerReference` (Leitweg-ID only for public sector). Validation via `KoSIT Validator` (open source, Java) — **SHIP THIS IN THE PIPELINE**.
2. **ZUGFeRD 2.3** Profile **EN 16931 (Comfort)** — PDF/A-3 with embedded `factur-x.xml`. Use the official FeRD `mustangproject` (Java, Apache-2) or the Python library `drafthorse` or `factur-x`. 
3. *(Nice-to-have)* **ZUGFeRD Profile XRechnung** (ZUGFeRD ≥ 2.1 variant aligned to XRechnung) — preferred for mixed environments.
4. *(Defer)* Pure UBL — not much DE demand.

#### 2.5.2 Core EN 16931 business terms (BT-codes) the product MUST map

Must-have minimum set (selection — full list is ~170 BTs/BGs):

| BT-Code | Meaning | Mandatory? |
|---|---|---|
| BT-1 | Invoice number | Yes |
| BT-2 | Invoice issue date | Yes |
| BT-3 | Invoice type code (UNTDID 1001: `380`=Commercial Invoice, `381`=Credit Note, `384`=Corrected, `389`=Self-Billed) | Yes |
| BT-5 | Currency code (ISO 4217) | Yes |
| BT-6 | VAT accounting currency (optional) | No |
| BT-9 | Payment due date | Cond. |
| BT-10 | Buyer reference (Leitweg-ID for public, PO for private) | Yes |
| BT-13 | Purchase order reference | Cond. |
| BT-17 | Tender / contract ref | No |
| BT-22 | Note | No |
| BT-23 | Business process type (`urn:fdc:peppol.eu:2017:poacc:billing:01:1.0` etc.) | Cond. |
| BT-24 | Specification identifier (`urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0`) | Yes |
| BT-27/BT-44 | Seller/Buyer name | Yes |
| BT-31 | Seller VAT ID | Yes |
| BT-32 | Seller tax reg ID | Cond. |
| BT-34 | Seller electronic address + BT-34-1 scheme ID (e.g., `EM` email, `DE:LEITW` Leitweg-ID) | Recommended |
| BT-48 | Buyer VAT ID (required in reverse charge) | Cond. |
| BT-81 | Payment means type code (UNTDID 4461: `58`=SEPA CT, `59`=SEPA DD, `30`=bank transfer) | Yes |
| BT-84..89 | IBAN / BIC | Cond. |
| BG-22 (BT-106..115) | Document totals | Yes |
| BG-23 (BT-116..121) | VAT breakdown per rate | Yes |
| BG-25 (BT-126..) | Invoice line (per position) | Yes |
| BT-130 | **Unit of measure code** — **UN/ECE Rec. 20** (e.g., `C62`=piece, `HUR`=hour, `DAY`=day, `PCE`=piece(=C62 equiv), `KGM`=kg, `MTR`=m). This trips up EVERYONE. | Yes |
| BT-151 | VAT category code (UNTDID 5305: `S`=Standard, `AE`=Reverse charge, `E`=Exempt, `Z`=Zero, `G`=Export, `K`=Intra-EU, `O`=Not subject, `L`=Canary, `M`=Ceuta/Melilla) | Yes |
| BT-152 | Line VAT rate | Yes |
| BT-120 | VAT exemption reason text | Cond. |
| BT-121 | VAT exemption reason code (VATEX-EU-AE, VATEX-EU-79-C, etc.) | Cond. |

**Gotcha — BT-130 unit codes**: Invoices fail validation when product managers let users type free-text units like "Std." or "Stück". The SaaS must maintain a **dropdown of UN/ECE Rec. 20 codes** with human labels (`"Stunde (HUR)"`, `"Stück (C62)"`, `"Tag (DAY)"`, `"Pauschal (XPP)"`). Common codes for media agencies:
- `HUR` — hour
- `DAY` — day
- `C62` — piece / pauschale Einheit
- `H87` — piece (alternate, discouraged)
- `WEE` — week
- `MON` — month
- `LS` — lump sum
- `XPP` — "Packung" (only for physical)

#### 2.5.3 PDF/A-3 embedding rules for ZUGFeRD

- PDF must be **PDF/A-3b** (ISO 19005-3), **not** PDF/A-1 or PDF/A-2 (those don't allow arbitrary attachments).
- XML attachment **MIME**: `text/xml` or `application/xml`.
- **Relationship**: `/Alternative` (EN 16931 recommends this) per `/AFRelationship` — the PDF VIEW and the XML are declared alternative renderings.
- **AFN**: `factur-x.xml` (ZUGFeRD 2.x canonical) OR `xrechnung.xml` (ZUGFeRD-XRechnung profile) OR `zugferd-invoice.xml` (legacy 1.x).
- XMP metadata must include the **ZUGFeRD/Factur-X schema** declaring `ConformanceLevel` (e.g., `EN 16931`) and `DocumentType` (`INVOICE`). Validators check this.
- No encryption, no password, no form fields with unsigned JS.
- Fonts must be embedded (PDF/A requirement).

Implementation libraries (review 2025–2026):
- **Java**: `mustangproject` (FeRD), `konik`
- **.NET**: `FacturX.NET`, `ZUGFeRD-csharp`
- **PHP**: `horstoeko/zugferd`, `easybill/zugferd-php`
- **Python**: `factur-x` (pypi), `drafthorse`
- **Node.js**: `node-zugferd` — less mature; may need to shell out to Java or port.

#### 2.5.4 Validation pipeline (non-negotiable for a SaaS)

1. **Generate** XML from canonical invoice model.
2. **Schema-validate** against the CII XSD (or UBL XSD).
3. **Schematron-validate** against the KoSIT XRechnung rules (for XRechnung) or FeRD Schematron (for ZUGFeRD).
4. **Business rule check**: CIUS (Core Invoice Usage Specification) — e.g., if `BT-151`=`AE` (Reverse Charge) then the VAT rate must be `0` AND a VAT-exemption reason BT-120/121 is set.
5. **PDF/A-3 valid**: use `veraPDF` (open source).
6. Validation failure → block send, surface error with BT-code.

Run this on **every** invoice. Cache validation results for audit.

### 2.6 Transport — how the E-Rechnung physically moves

Legal transport channels (BMF 15.10.2024 is agnostic):

- **Email** with XRechnung XML or ZUGFeRD PDF as attachment. ✅ Simplest. Most common.
- **Download portal** (you upload; recipient logs in and downloads). ✅ Legal if retrievable.
- **Peppol network** (AS4, SBDH envelope). ✅ Preferred in regulated sectors. Required for gov (via Peppol 4-corner model, Leitweg-ID).
- **De-Mail / eIDAS-signed email** — overkill for most.
- **EDI (EDIFACT/Classic)** — legal until **2027-12-31**, thereafter only if format is EN 16931-compliant.

**Peppol — do you need it?**
- **Not mandatory** for B2B in Germany. Mandatory for federal public authorities (ZRE/OZG-RE receive portals, speaking Peppol).
- **Strategic**: if you want to sell to public-sector-adjacent clients, YES. Become an **Access Point** OR partner with one (Basware, Pagero, B2Brouter, Storecove, Seeburger).
- For a small media agency SaaS, add Peppol as a **premium plan feature** by year 2 — solves the "invoice the Bundesamt" edge case.
- German Leitweg-ID scheme: `Prefix-Grobadresse-Feinadresse-Prüfziffer` — e.g., `991-12345-67`. Buyer provides. Goes in BT-10 (Buyer reference) and Peppol SBDH header.

### 2.7 What's legal for RECEIVING

From **2025-01-01**:
- Every B2B recipient must **accept** a structured E-Rechnung if the sender chooses to send one. Consent to PDF can be withdrawn at any time.
- **Minimum technical**: The sender is allowed to email the XML/ZUGFeRD PDF. So the recipient must have **an email address that the sender knows about** (or a portal login). No need to operate Peppol.
- BMF is explicit: **a normal email inbox is sufficient receiving infrastructure**. But the recipient is responsible for **archiving in a GoBD-compliant way** the **XML as primary artifact** (not just the PDF render). This is the receiving-side GOTCHA.

### 2.8 Receiver-side duties (affects product UX!)

- Store the **original XML** (bit-identical) for the retention period.
- Store the PDF or a rendered view for readability (the PDF visual is not the primary book record — the XML is).
- Parse the XML to extract BT fields for the Eingangsrechnungsbuch (see §3).
- Visualize the XML (use KoSIT's XRechnung Visualization XSL) so the accountant sees a human-readable invoice.

**Product play**: the "Inbox" feature — forward-email to `your-company@posteingang.saas.de` → auto-parse, extract, file, render. This is the **killer feature** for adoption.

### 2.9 Digital signature / eIDAS

- **Not required** for E-Rechnungen in DE. §14 Abs. 3 UStG used to list "Qualifizierte elektronische Signatur (QES)" as one of multiple ways; since 2011 a signature is optional, **Echtheit / Unversehrtheit / Lesbarkeit** may be ensured by any "innerbetriebliches Kontrollverfahren" (ICV).
- An ICV typically = a documented workflow (4-eyes check, reconciliation with order/delivery) — **not a technical signature**. This is a GoBD/Verfahrensdokumentation chapter.
- QES is still useful in regulated B2B (banks, tender submissions) and can be a **premium add-on**.

### 2.10 ViDA preview (2028–2030)

- EU Council adopted ViDA 2025-03-11.
- **DRR (Digital Reporting Requirements)** and **e-invoicing cross-border B2B mandatory by 2030** (some MS will pre-align by 2028).
- Germany is expected to introduce a **Digitale Meldepflicht (DMP)**: transaction-by-transaction reporting to Finanzamt, probably via Peppol 5-corner model + E-Invoice → near-real-time. Draft legislation expected 2026–2027.
- **Product implication**: architect your pipeline so that each sent invoice can **also be pushed to a reporting endpoint** (the transaction envelope). Don't couple e-invoice generation tightly to email dispatch.

### 2.11 Product-killing gotchas (E-Rechnung)

- **Silent validation failures**: If you don't block on Schematron errors, customers send invoices that the recipient's validator rejects → user blames you. Always block + explain.
- **PDF ≠ primary**: if a customer drags a screenshot "invoice" into your tool, it's not an E-Rechnung. Don't accept.
- **"Ich hab PDF bekommen und jetzt?"**: Recipients will forward random PDFs. Handle with a "not an E-Rechnung — this is a sonstige Rechnung" flag.
- **Invoice number must be unique GLOBALLY in your account, not per customer.** Many SaaS ship this wrong.
- **Preview ≠ final**: users expect WYSIWYG. The XML IS the truth. The PDF is a human aid. Make that clear in the UX.
- **Line item with only discount** — BR-CO-23 (EN 16931): a line with `NetAmount` of 0 because of 100% discount is invalid. Reject or convert.

---

## 3. GoBD (Archival, Immutability, Audit)

### 3.1 Legal basis

- **Abgabenordnung (AO)**: §§ 145–147 AO (bookkeeping, records, retention).
- **BMF-Schreiben zur GoBD** — "Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern, Aufzeichnungen und Unterlagen in elektronischer Form sowie zum Datenzugriff".
  - Original 2014-11-14.
  - **Revision 2019-11-28** (substantive update on cloud, scan-only, mobile).
  - **Minor update 2024-03-11 + 2024-12-09** (clarifications on E-Rechnung and Datenträgerüberlassung).
- **EU GoBD parallel**: national-level only; EU has no equivalent.

### 3.2 Retention periods — 2025 (CHANGED)

**Bürokratieentlastungsgesetz IV** (BGBl. I 2024 Nr. 323, effective 2025-01-01) reduced retention periods **from 10 years to 8 years** for the following:

| Document type | Retention | From | Basis |
|---|---|---|---|
| **Rechnungen (eingehend & ausgehend)** | **8 Jahre** (was 10) | End of calendar year in which invoice was issued/received | §14b UStG, §147 Abs. 3 AO |
| **Buchungsbelege** (general) | **8 Jahre** (was 10) | — | §147 Abs. 3 AO |
| **Handelsbücher, Inventare, Bilanzen, Jahresabschlüsse, Arbeitsanweisungen** | **10 Jahre** (unchanged) | — | §257 HGB / §147 AO |
| **Handels- und Geschäftsbriefe (empfangen & abgesandt)** (including offers/Angebote that led to contract, contract correspondence) | **6 Jahre** (unchanged) | — | §257 HGB / §147 AO |
| **Verfahrensdokumentation** | = retention of the data it documents | — | GoBD 10.1 |
| **Angebote (die NICHT zum Auftrag führten)** | No statutory retention — but **6 Jahre** as Geschäftsbrief if they qualify | — | §257 HGB |

**Transition rule (important!)**: The 8-year reduction applies to records where the **old 10-year period has not yet expired on 2024-12-31**. So a 2014 invoice (10 years → expires 2024-12-31) still ended at 10, but a 2017 invoice now expires 2025 (end of 2017+8 = end of 2025).

**Anti-gotcha UI**: tooltip "Löschen nach: 2033-12-31 (§147 AO, 8-Jahre-Regel seit BEG IV 2025)".

### 3.3 GoBD principles — what must hold

1. **Nachvollziehbarkeit & Nachprüfbarkeit** — a third party must be able to trace every transaction within reasonable time.
2. **Vollständigkeit** — all business-relevant data captured, no selective deletion.
3. **Richtigkeit** — content correct, consistent with reality.
4. **Zeitgerechte Buchung und Aufzeichnung** — record promptly. Guidance: cash transactions daily; others within 10 days for periodic, but max **by end of following month**.
5. **Ordnung** — systematic, with a chart of accounts (Kontenrahmen, usually SKR03 or SKR04).
6. **Unveränderbarkeit** — once booked, a change must not be technically possible without leaving a trace. See 3.4.

### 3.4 Unveränderbarkeit — how to PROVE no changes

GoBD does not prescribe a specific tech; it says the **result** must be unveränderbar.

Acceptable technical approaches:
- **Write-Once storage** (WORM) — e.g., cloud object lock.
- **Cryptographic chaining** — each record's hash includes the prior record's hash (Merkle chain) → append-only ledger.
- **Signed audit log** with third-party timestamping — TSA-signed logs with a **RFC 3161** timestamp authority.
- **RDBMS with immutable `created_at`, audit triggers, and periodic cryptographic checkpoint** to an external service (e.g., chainpoint.org, an OpenTimestamps server, or AWS QLDB).

**What is NOT enough**:
- A regular SQL table allowing UPDATE.
- Excel/CSV files.
- Unsigned log files.

**Minimum SaaS design**:
- Application-level: `invoice` table is **append-only**; edits create a new version row referencing the prior `parent_id`. `status` transitions are rows, never column flips.
- Integrity: compute `row_hash = SHA256(content + prev_hash)`. Chain hashes per tenant.
- Export of the chain alongside Datenträgerüberlassung export.
- Document the approach in your **Verfahrensdokumentation**.

### 3.5 Verfahrensdokumentation (VDok)

Mandatory written documentation of every data-processing step. Components (GoBD 10.1):

- **Allgemeine Beschreibung** — what the system does, which processes it covers.
- **Anwenderdokumentation** — user handbook (or linked KB article).
- **Technische Systemdokumentation** — architecture, data model, integrity mechanisms, hashing scheme, backup, cloud provider, certifications (ISO 27001, …).
- **Betriebsdokumentation** — operations manual: deploys, incident response, backups, retention policy.
- **Kontrollverfahren** — the ICV that ensures Echtheit/Unversehrtheit/Lesbarkeit of digital docs.
- **Change history** (versioned).

The **user (your customer)** must maintain their VDok — but **the SaaS can ship a template** pre-filled with all the technical parts, so the user only fills in their process bits. **This is a massive onboarding accelerator** (DATEV, sevdesk, lexoffice all do this).

### 3.6 Datenträgerüberlassung — "Z3 data export" for tax audit

Under §147 Abs. 6 AO, the tax auditor (Betriebsprüfer) has three access modes:

- **Z1** — unmittelbarer Zugriff (read-only login into your system).
- **Z2** — mittelbarer Zugriff (you run queries, auditor prescribes).
- **Z3** — **Datenträgerüberlassung**: auditor receives a **machine-readable export** on medium (USB today).

**Z3 format — the "IDEA file" / GDPdU / GoBD-Export**:
- Defined by the **IDEA software** (Audicon) spec — the Finanzbehörden standard audit tool.
- File structure: **index.xml** (describes each data file: table, fields, column types, encoding) + **CSV data files** (one per table) + (optionally) **PDFs / originals folder**.
- Encoding: **Windows-1252** or UTF-8; CSVs semicolon-separated, quoted strings.
- Field types: `NUMBER`, `CHAR`, `DATE` (format: `YYYY-MM-DD`), `ALPHANUMERIC`.
- **Descriptor `index.xml`** — GDPdU Descriptor Schema v1.0; each table definition includes the CSV file path, delimiter, skipfirst header row count, field type and length.
- Must cover every relevant table: `invoices`, `invoice_lines`, `customers`, `payments`, `stornos`, `audit_log` — plus the cryptographic chain if using one.

**Practical**: ship a one-click `GoBD-Audit-Export.zip` button. The tax auditor's workflow expects it.

### 3.7 Scanning of paper invoices ("ersetzendes Scannen")

Per BMF 2014/2019:
- Paper invoice scanned → **paper may be destroyed** if scan is **bildlich und inhaltlich identisch**, process is **documented** (VDok chapter "ersetzendes Scannen"), and scan is stored **unveränderbar** for the retention period.
- **Recommendation**: document the scan process (scanner model, resolution, color, who, when), run OCR, store both image and OCR text.

### 3.8 Belegfunktion — "every booking has a receipt"

- "Keine Buchung ohne Beleg."
- In SaaS: every transaction (booking) must reference its **Beleg** (invoice, receipt, contract). The Beleg must be retrievable from the booking.
- For E-Rechnungen: the **XML is the Beleg** (not the PDF render). Store the XML.

### 3.9 GoBD-Testat / certification

- **There is no legally mandatory GoBD certification** for SaaS. GoBD compliance is a responsibility of the **end user** (Steuerpflichtiger), not the tool vendor.
- But: a **Testat** (attestation) from an auditor (WP, Steuerberater-Gesellschaft) or **IDW PS 880** (Software-Produkt-Prüfung) attestation is a trust signal buyers ask for.
- Providers: **PwC, KPMG, Deloitte, EY**; also specialized shops: **WTS, Ebner Stolz, AWADO, Mazars, Audicon** (parent of IDEA).
- **IDW PS 880** — "Prüfung von Softwareprodukten" — the gold standard. Describes scope, reporting, findings. A report is re-verified annually for material changes.
- Cost ballpark: €20k–€80k first time, €10k–€30k annually. Plan for it in year 2.
- An **SOC 2 Type II** or **ISO 27001** covers the infosec dimension but NOT GoBD substance.

### 3.10 Cloud + GoBD — data residency

Per GoBD (2019) 9.3:
- **Cloud storage is allowed** including outside Germany, provided:
  - Access rights for the Finanzbehörde (Z1–Z3) are ensured.
  - The taxpayer remains able to fulfill all retention and audit duties.
  - The taxpayer notifies the Finanzamt if records are kept **outside the EU** (§146 Abs. 2a AO) and applies for permission if applicable.
- **Within EU**: no permission required.
- **Within DE**: obviously fine.
- **Product**: data in AWS/GCP EU-Central (Frankfurt) is fine. Hetzner/IONOS DE is best for marketing. US-only (e.g., Supabase default US region) is a **gotcha** — your agency customer would need a FA exemption for each year.

---

## 4. DSGVO / Data Protection

### 4.1 Legal basis

- **DSGVO / GDPR** — Regulation (EU) 2016/679.
- **BDSG neu** — Bundesdatenschutzgesetz (2018).
- **TTDSG (Telekommunikation-Telemedien-Datenschutz-Gesetz)** — 2021-12-01, replaced by **Digitale-Dienste-Gesetz (DDG)** and expanded **TDDDG** (Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz) since 2024-05-14.
- **Schrems II** ruling (CJEU C-311/18, 2020) and **Data Privacy Framework** (EU-US DPF, 2023-07-10) — adequacy for certified US importers.

### 4.2 AV-Vertrag (DPA — Data Processing Agreement)

Mandatory per Art. 28 DSGVO whenever you process personal data **on behalf of** a controller (your customer).

A DPA MUST contain (Art. 28 Abs. 3):

1. Subject matter and duration.
2. Nature and purpose of processing.
3. Type of personal data and categories of data subjects.
4. Controller's and processor's obligations and rights.
5. Processor's obligations:
   - Act only on documented instructions (incl. transfers).
   - Confidentiality of authorised personnel.
   - TOMs per Art. 32.
   - Engage sub-processors only with prior consent (see 4.6).
   - Assist controller in responding to data-subject requests.
   - Assist with breach notifications, DPIAs, consultations.
   - Delete or return data at end of service.
   - Allow audits and inspections.

**Template approach**:
- Ship a **pre-signed DPA** (one-click accept during signup) — now standard in the industry.
- Many German buyers still want their **own DPA template**; provide a comparison/redline guide.
- Include an EU SCC annex for any non-EU sub-processors (see 4.4).

### 4.3 Controllers, Processors, Joint Controllership

- **You (SaaS vendor) = Processor** for the customer's data stored in your system (their invoices, their customers' data).
- **You = Controller** for your own account data (billing, support, marketing consent) about your direct customer.
- Edge case: aggregate analytics across tenants → be careful; Art. 26 Joint Controllership may apply. Avoid it.

### 4.4 Data residency + transfers

- **EU/EWR**: no restrictions.
- **US**: Since 2023-07-10, transfers to a **DPF-certified** US recipient are possible without additional measures. Otherwise, **SCC (Standard Contractual Clauses)** + TIA (Transfer Impact Assessment) + supplementary measures.
- **Other third countries**: SCC + TIA. Avoid.
- **Product recommendation**: Host the primary infrastructure in **EU region** (AWS eu-central-1 Frankfurt, or ideally German providers IONOS, Hetzner, OVH EU for marketing optics). Use EU-only subprocessors if possible.
- **Red flag**: Supabase default (us-east), Firebase, Vercel default (US routing). Must be explicitly configured EU-region and explained in sub-processor list.

### 4.5 TOMs — minimum technical & organisational measures (Art. 32)

Non-exhaustive minimum for a German B2B SaaS:

**Technical**:
- Encryption at rest (AES-256) for database and object storage.
- Encryption in transit (TLS 1.2+; HTTPS-only, HSTS).
- Access control: role-based (RBAC), least privilege, MFA for admins, strong password policy (NIST 800-63B-compliant).
- Pseudonymisation where possible.
- Secure secret management (not in env files in git!).
- Regular security updates, vulnerability scanning, dependency SBOM.
- Backups: encrypted, regular, restore-tested, retention policy.
- Logging and monitoring (access logs, retained).

**Organisational**:
- Data protection officer (DSB) — required if ≥ 20 persons process personal data automatically, or if DPIA-triggering activities (Art. 37 DSGVO; §38 BDSG).
- Personnel: confidentiality obligations (Verpflichtung auf das Datengeheimnis).
- Training.
- Incident response plan (72-hour breach notification per Art. 33).
- Vendor management (sub-processor reviews).
- Policies: data retention, deletion, data minimization.

**Hardening hit-list (MUST for B2B in DE)**:
- ISO 27001 certification (minimum in year 2).
- SOC 2 Type II (for US customers, but also well-received in DE).
- Penetration test annually (documented).
- BSI IT-Grundschutz basic compliance (optional; German buyers like).

### 4.6 Sub-processors

- List publicly at `/subprocessors` or in DPA Annex. Keep up-to-date.
- Typical stack:
  - Hosting: AWS / GCP / Hetzner / IONOS.
  - Email: Postmark, Amazon SES (EU), Mailjet (FR) — NOT Mailgun US-only.
  - Analytics: **Plausible / Matomo self-hosted** (GDPR-safe) — NOT Google Analytics without consent mode.
  - Error tracking: Sentry.io — self-hosted or EU-region.
  - Support chat: Intercom (US) — risky without DPF cert; check current. Crisp (FR) is safer.
- **Notify customers of changes** with opt-out window (usually 30 days).

### 4.7 Cookie consent (TTDSG/TDDDG)

- **Every cookie/storage access that is NOT strictly necessary** requires **opt-in consent** (Einwilligung per §25 TTDSG/TDDDG). "Berechtigtes Interesse" is NOT a valid legal basis for cookies.
- Banner requirements (per DSK guidance 2021 and BGH "Planet49" 2020):
  - Equal-prominence Accept and Reject buttons.
  - No pre-ticked checkboxes.
  - Granular categories.
  - Easy withdrawal (same click-distance as accept).
  - No "cookie wall" blocking access if rejected (unless paid alternative offered — gray area).
- **Implementation**: Usercentrics, Cookiebot, Klaro (open source), Complianz. Document decision.
- For a SaaS LOGGED-IN product: first-party session cookie (Auth) = strictly necessary, no consent. All analytics/marketing cookies need consent.
- **Gotcha**: Google Analytics without IP anonymization + without consent = **abmahnfähig** since 2022 ("Google Fonts Urteil" and similar). Either Plausible/Matomo/umami or carefully configured GA4 with CMP.

### 4.8 Data subject rights (Art. 15–22)

Ship all of these within 30 days of request:

- **Art. 15 Auskunft**: Full export of data about the requester (incl. processing purposes, retention, recipients).
- **Art. 16 Berichtigung**: Correct inaccurate data.
- **Art. 17 Löschung ("Right to be forgotten")**: Delete data when no longer required. BUT: retention duties override (e.g., invoices → 8 years, §147 AO). Document the override.
- **Art. 18 Einschränkung**: Restrict processing.
- **Art. 20 Datenübertragbarkeit**: Machine-readable export (JSON/CSV) of provided data.
- **Art. 21 Widerspruch**: Object to processing based on Art. 6(1)(e)/(f).
- **Art. 22**: No solely automated decision with legal effect (not usually relevant).

**Product features (must-have)**:
- "Export my data" button (JSON + CSV, all user-related rows).
- "Delete my account" button (soft-delete → hard-delete after retention-aware grace).
- Anonymisation path for legally-required retained data (redact PII, keep financial facts).

### 4.9 Breach notification

- Art. 33: Report to supervisory authority within **72 hours** of awareness.
- Art. 34: Inform affected persons without undue delay if high risk.
- SaaS must notify its customers (controllers) **without undue delay** per Art. 33 Abs. 2 — build an incident comms template now.

---

## 5. Bürgergeld / Jobcenter for Self-Employed (HIGH-VALUE MOAT)

> This is the section most SaaS competitors skip. German freelancers struggling between gigs often claim **Bürgergeld (SGB II)** — and the "EKS" process is a bureaucratic nightmare that NO existing invoicing tool handles well. An EKS wizard is a huge TAM unlock.

### 5.1 Legal basis

- **SGB II** (Sozialgesetzbuch II) — "Bürgergeld, Grundsicherung für Arbeitsuchende" (renamed 2023-01-01 from Hartz IV / ALG II). Governs benefits.
- **§11, §11a, §11b SGB II** — income accountability.
- **Bürgergeld-Verordnung (Bürgergeld-V)** — precise rules on income calculation (was: "ALG-II-Verordnung").
- **§3 Bürgergeld-V** — specifically: income from self-employment.
- **Weisung der Bundesagentur für Arbeit zu §11 SGB II** — latest 2024-12 revision.

### 5.2 Anlage EKS (`Erklärung zum Einkommen aus selbständiger Tätigkeit`)

Required whenever a Bürgergeld recipient has **self-employed income**. The form exists in two variants:

- **EKS-Vorläufig (monthly, during Bewilligungszeitraum)**: prognose income/expenses for the 6–12 month Bewilligungszeitraum (usually 6 months under current rules).
- **EKS-Abschließend / Endgültig (after Bewilligungszeitraum)**: actual income/expenses per month, reconciliation with Jobcenter.

**Form IDs** (as of 2025):
- `BA SA40` (Anlage EKS) — for both, but completed differently.
- `BA SA40.1` — supplementary sheet per month.

### 5.3 Bewilligungszeitraum (BWZ)

- **Standard**: 12 months (§41 Abs. 3 SGB II) — since 2023-01-01 Bürgergeld reform changed it from 12 to... formally still 12, BUT Jobcenter may shorten for variable income (§41a SGB II).
- For **self-employed**, Jobcenter typically sets **6 months** because income fluctuates (then requests new EKS-Vorläufig).
- Vorläufige Bewilligung (§41a SGB II) is the normal mode for self-employed — gets "endgültig festgestellt" after the period end.

### 5.4 EKS — the exact line structure (2025 form)

**Header block**:
- Name, Geburtsdatum, BG-Nr. (Bedarfsgemeinschaft number), Aktenzeichen.
- Bewilligungszeitraum von / bis.
- Art der selbständigen Tätigkeit (free text).

**Monthly section (repeated × Number of months)**:

**A. BETRIEBSEINNAHMEN** (Revenue):
- Betriebseinnahmen aus Verkäufen/Dienstleistungen (netto falls Regel-USt, brutto falls Kleinunternehmer).
- Einnahmen aus Eigenverbrauch.
- Vereinnahmte Umsatzsteuer (falls Regel-USt).
- Erstattete Vorsteuer/Umsatzsteuer vom Finanzamt.
- Andere Betriebseinnahmen (z.B. Auflösung von Rückstellungen — selten für Freiberufler).
- **Zufluss-Prinzip**: EKS rechnet **zahlungsfluss-basiert** (Zu-/Abfluss), nicht wie EÜR unbedingt nach Soll.

**B. BETRIEBSAUSGABEN** (Expenses — note: NOT identical to EÜR list!):
- Wareneinkauf.
- Personalkosten.
- Raumkosten (Miete, Nebenkosten) — **anteilig, falls "Arbeitszimmer zu Hause"**, und NUR wenn steuerlich anerkannt.
- Betriebliche Versicherungen.
- Kraftfahrzeugkosten — siehe 5.5 für KFZ-Besonderheiten.
- Werbung, Repräsentation.
- Bürokosten, Porti, Telefon (anteilig).
- Fortbildung.
- Buchhaltung, Beratung.
- Reisekosten.
- Abschreibungen — **sind hier NICHT anzusetzen** (!) — §3 Abs. 2 Bürgergeld-V — nur **tatsächlich bezahlte** Anschaffungen (nicht Abschreibungen).
- Gezahlte Umsatzsteuer (an Finanzamt).
- Gezahlte Vorsteuer (an Lieferanten).
- Andere Betriebsausgaben.

### 5.5 DIFFERENCES from EÜR (CRITICAL)

Expenses **allowed in EÜR but NOT deductible for EKS** (§3 Bürgergeld-V):

- **AfA (Abschreibungen)** — only actual cash outflow counts.
- **Degressive/Sonder-AfA** — same reason.
- **Bewirtung 70%** — only tatsächlicher Aufwand, and Jobcenter may reduce to "notwendige Betriebsausgaben" — **beware**.
- **Häusliches Arbeitszimmer**-Pauschale (€1,260/Jahr) — grey area; Jobcenter often refuses the tax-law flat rate — only actual, apportioned Miete.
- **Geschenke bis €35** — usually rejected ("not necessary").
- **Kosten, die auch privat veranlasst wären** — Jobcenter applies strict "Notwendigkeit".
- **Rücklagen** — never.
- **Beiträge an Vermögenswirksame** — never.
- **Gesetzliche Krankenversicherung / Altersvorsorge** — NOT deducted from Betriebsausgaben (they are separately considered as "Absetzbeträge vom Einkommen" — see 5.7).

Rule of thumb: Jobcenter accepts an expense only if it is **unmittelbar und notwendig** für den Betrieb — plus **tatsächlich bezahlt im Zeitraum**.

### 5.6 Income accounting — monthly

Per §3 Abs. 4 Bürgergeld-V (post-2023 reform):
- Average income over the **Bewilligungszeitraum**: sum of monthly (Einnahmen – anerkannte Ausgaben) ÷ months = Ø-monatl. Einkommen aus Selbständigkeit.
- This average is then applied **per month** for the Anrechnung.
- Alternative: per-month accounting if Jobcenter agrees — not default.
- The "vorläufige" EKS sets **Prognose** → monthly Bürgergeld set provisionally → **endgültige** EKS reconciles → Nachforderung or Rückerstattung.

### 5.7 Freibeträge from earned income — §11b SGB II

From the **Ø-monthly Einkommen**, these Absetzbeträge are taken BEFORE Anrechnung on Bürgergeld:

- **Grundfreibetrag**: €100 (flat, if any earned income). — "Absetzbetrag für Versicherungen" §11b Abs. 2 S. 1.
- **Erwerbstätigenfreibetrag**:
  - 20% of Einkommen between €100 and €520.
  - 30% of Einkommen between €520 and €1,000 (€1,000 for BGs with minor children; else €1,200 border depending on case).
  - 10% between €1,000 (or €1,200) and €1,500.
- Special for young people (U25 etc.) — different bands.
- **Werbungskostenpauschale**: not applied for self-employed (that's for employees). But: individual "tatsächliche Werbungskosten" may be deducted in the expense list.
- **KFZ-Pauschale**: §6 Abs. 1 Nr. 3a Bürgergeld-V — if using own car for business, **€0.10 / km** as pauschaler Abzug (different from tax-law €0.30 Kilometerpauschale!).
- **Ehrenamtspauschale**: €250/month (= €3,000/year, §3 Nr. 26a EStG) is **frei** if it qualifies as Übungsleiter/Ehrenamt — for a media agency owner usually N/A.

### 5.8 Beispielrechnung (MUST be in the product as a walkthrough)

> **Setting**: Media agency owner, single, no kids, monthly rent €800 (Arbeitszimmer 20%), Kranken- & Pflegevers. freiwillig gesetzlich €400, Altersvorsorge "Rürup" €150, no car.

**Bewilligungszeitraum: 2026-04-01 – 2026-09-30 (6 Monate)**

Monthly (example month):
- Einnahmen (netto): €2,500
- Ausgaben:
  - Miete Arbeitszimmer anteilig: 20% × €800 = €160
  - Telefon/Internet anteilig 50%: €40
  - Software-Abos: €80
  - Fahrten (PKW geliehen, 100 km × €0.10): €10
  - Fortbildung: €0
  - Sonstiges: €30
  - **Σ Ausgaben: €320**
- Einkommen aus s.T. = €2,500 − €320 = **€2,180 / Monat**

**Absetzbeträge (§11b SGB II)**:
- Grundfreibetrag: €100.
- Erwerbstätigenfreibetrag:
  - €420 × 20% = €84 (Segment 100–520)
  - €480 × 30% = €144 (Segment 520–1,000)
  - €500 × 10% = €50 (Segment 1,000–1,500)
  - > €1,500: 0%
  - = €278
- Gesamt Absetzbeträge: **€378** (simplified; actual Versicherungspauschale may differ).

**Anrechenbares Einkommen**: €2,180 − €378 = **€1,802**

**Bürgergeld-Regelsatz Alleinstehend 2026** (pinned 2025: €563, 2026 approx frozen, tbd): €563.
**+ Unterkunft + Heizung** (angemessen): €800 + HK = €950.
**= Bedarf**: €1,513.

Income (€1,802) > Bedarf (€1,513) → **kein Bürgergeld-Anspruch** in diesem Monat.

BUT: the EKS is averaged over BWZ — so if in another month Einnahmen were €500, the average might yield €900 anrechenbares Einkommen → €1,513 − (900 − 378) = restanspruch ~ €991.

Nach BWZ: Endabrechnung. Wenn tatsächliche Einnahmen < Prognose → Nachzahlung. Wenn > Prognose → Rückforderung (§41a Abs. 3 SGB II).

### 5.9 Vorläufige vs. Endgültige Bewilligung

- **§41a SGB II**: Vorläufige Bewilligung when income fluctuates. Default for self-employed.
- After BWZ: **abschließende Entscheidung** (§41a Abs. 3 SGB II) — within 1 year usually.
- If actual > vorläufig: **Rückforderung** (with admin charges possible).
- If actual < vorläufig: **Nachzahlung**.
- Missing EKS-Abschließend → Jobcenter can estimate (§41a Abs. 4) — usually unfavorably.

### 5.10 Einreichung / Digital submission

- **Standard**: paper or PDF attached to secure message via **jobcenter.digital** (BA-Portal) — user logs in with `Nutzerkonto Bund` (BundID) or `jobcenter.digital` direct account.
- **E-Akte Jobcenter**: internal BA system — receives submissions.
- Upload formats: **PDF** (max 10 MB/file, 50 MB total, typically). Form SA40 as PDF with form fields (fillable).
- Some BAs allow structured upload via partner portals (experimental).
- **Product feature**: one-click "EKS für April 2026 generieren" → auto-fills SA40 PDF with the user's invoice+expense data from the SaaS → user downloads and uploads to jobcenter.digital.

### 5.11 Anrechnungsregeln when income exceeds threshold

- If monthly income (nach Absetzbeträge) > Bedarf → no Bürgergeld for that month (BWZ-average applied).
- If > threshold for **entire BWZ** → no renewed Bewilligung (Freistellung).
- **Freibetrag bei Berufsausbildung** / "Schonvermögen" — separate, see SGB II §12 (asset rules): currently **€15,000 Freibetrag erstes Jahr** ("Karenzzeit" 12 Monate, since 2023), thereafter €40,000 − age allowance.

### 5.12 SaaS-specific features for EKS module

- **Onboarding**: "Bist du aktuell Bürgergeld-Empfänger?" → EKS Workflow an.
- **Chart of accounts**: maintain two parallel views — EÜR (tax) and EKS (Jobcenter). Many expense rules diverge.
- **Monthly closing**: generate EKS-Monatsübersicht.
- **Doc generator**: fill BA SA40 PDF auto.
- **Prognose mode**: user enters expected next-month revenues → calculates vorläufiges Bürgergeld.
- **End-of-BWZ reconciliation**: delta monthly, generate "endgültige EKS".
- **Support content**: canned FAQ on typical Jobcenter pushbacks ("Jobcenter will Arbeitszimmer nicht anerkennen"), sample objection letter.

---

## 6. EÜR (§4 Abs. 3 EStG)

### 6.1 Legal basis

- **§4 Abs. 3 EStG** — Einnahmen-Überschuss-Rechnung.
- Applicable if:
  - Freiberufler (§18 EStG) — always optional.
  - Gewerbetreibende up to **€80,000 Gewinn/Jahr** OR **€800,000 Umsatz/Jahr** (since Wachstumschancengesetz 2024, raised from €60k/€600k). Over → Bilanzierungspflicht (§§140/141 AO).
- **Anlage EÜR** — form mandatory since tax year 2017 for electronic submission (§60 Abs. 4 EStDV) — paper only if "unbillige Härte".

### 6.2 Principle

- **Zufluss-/Abflussprinzip** (§11 EStG): revenue/expense counts when cash flows, with a **10-day-rule** for regular payments at year-end (§11 Abs. 1 S. 2 / Abs. 2 S. 2).
- Exception: **Umsatzsteuer-Vorauszahlungen** considered "regelmäßig wiederkehrend" — often booked to adjacent year.
- **Abnutzbare Wirtschaftsgüter > €800 netto**: AfA (Abschreibung) — §7 EStG.
- **GWG ≤ €800 netto** (since 2018): direct expense.
- **Sammelposten-Wahlrecht** for GWG zwischen €250–€1,000 — 5 Jahre linear.

### 6.3 Anlage EÜR — key lines (form 2025)

The **Formular Anlage EÜR 2025** (tax year 2025, filed 2026) has ~99 lines. Mandatory mapping to a SaaS Kontorahmen is critical.

**Key Zeilen** (abridged):

| Zeile | Inhalt |
|---|---|
| 1–10 | Identifikation, Art der Tätigkeit, §4 Abs. 3 check |
| **BETRIEBSEINNAHMEN** | |
| 11 | Betriebseinnahmen als umsatzsteuerlicher Kleinunternehmer |
| 12 | Umsatzsteuerpflichtige Betriebseinnahmen |
| 13 | Umsatzsteuerfreie und nicht umsatzsteuerbare Betriebseinnahmen |
| 14 | Vereinnahmte Umsatzsteuer und Umsatzsteuer auf unentgeltliche Wertabgaben |
| 15 | Vom Finanzamt erstattete und ggf. verrechnete Umsatzsteuer |
| 16 | Private Kfz-Nutzung |
| 17 | Sonstige Sach-, Nutzungs- und Leistungsentnahmen |
| 18 | Veräußerung oder Entnahme von Anlagevermögen |
| 19 | Auflösung von Rücklagen und Ausgleichsposten |
| **BETRIEBSAUSGABEN** | |
| 23 | Betriebsausgabenpauschale bestimmter Berufsgruppen (z.B. Schriftsteller, §18 EStG — 25% oder €2,455) |
| 25 | Waren, Rohstoffe, Hilfsstoffe |
| 26 | Bezogene Fremdleistungen |
| 27 | Gehälter, Löhne |
| 28 | Sozialabgaben |
| 29–33 | Abschreibungen (Zeilen 29 lineare AfA, 30 degressive AfA, 31 Sonder-AfA §7g, 32 AfA auf IAB-Wirtschaftsgüter, 33 Sofortabschreibung GWG) |
| 34 | Auflösung Sammelposten |
| 35–44 | Raumkosten (Miete, Pacht, Nebenkosten, häusliches Arbeitszimmer gesondert) |
| 45 | Sonstige Grundstücksaufwendungen |
| 46–55 | Werbe- und Reisekosten, Kfz, Bewirtung (70%) |
| 56 | Beiträge, Gebühren, Versicherungen |
| 57 | Porto, Telefon, Büromaterial |
| 58 | Fortbildung, Rechtsberatung |
| 59 | Buchführung |
| 60–64 | Miet-/Pacht-, Zins- und sonstige Aufwendungen |
| 65–79 | Gezahlte Vorsteuer / an Finanzamt gezahlte USt / sonstige Steuern |
| 80–87 | Ergänzende Angaben: Entnahmen, Einlagen, Investitionsabzugsbetrag (§7g) |
| 88–90 | Gewinn / Verlust |
| 91–99 | Sonderangaben (Schuldzinsen, innergemeinschaftl. Erwerbe etc.) |

### 6.4 Electronic submission via ELSTER / ERiC

- **ERiC** (ELSTER Rich Client) — core library from ELSTER (Bayerisches Landesamt für Steuern).
- ERiC DLL/SO available on request to registered SaaS developers ([www.elster.de/elsterweb/start](https://www.elster.de/elsterweb/start)).
- Supported OS: Windows (.dll), Linux (.so), macOS (.dylib).
- License: free for developers who have signed the ELSTER-Nutzungsvertrag.
- For cross-platform SaaS: run ERiC in a dedicated backend service (Linux). Input XML (per ELSTER schemas "datenabholung.xsd", "elster_anlage_eur.xsd"), output signed/encrypted package → transmit to ELSTER server.
- Alternatives: **ERiC Alternative (DATEV DFÜ)** — deprecated; **web API** — not officially provided as REST.
- **Gotcha**: Some data types (e.g., Anlage EÜR) must be filed annually before **31.07.** of following year (extended to 28.02. Zweitfolgejahr via Steuerberater).

### 6.5 Kontenrahmen: SKR03 vs. SKR04

- **SKR03** — process-oriented (by day-to-day activity): older, widespread among small businesses.
- **SKR04** — structure-oriented (matches HGB bilanzstruktur): preferred by DATEV for GmbHs/Bilanzierer.
- Both are DATEV standards (Kontenrahmen-Dokumentation).
- **For SaaS**: support BOTH. Default: SKR03 for freelancers / Kleinunternehmer, SKR04 for capital companies (UG/GmbH).
- Mapping tables are public (DATEV). Plus HGB-compliant Eigen-Kontenrahmen for edge cases.

### 6.6 Kleinunternehmer & EÜR

- Kleinunternehmer STILL must file EÜR (they have Gewinnermittlung duty).
- **Anlage EÜR Zeile 11** (Betriebseinnahmen als Kleinunternehmer) — Umsätze NETTO=BRUTTO (no VAT-split).
- Zeilen 14/15 (Umsatzsteuer): **leer**.
- Zeile 65+ (Vorsteuer): Vorsteuer aus Eingangsrechnungen ist bei Kleinunternehmer **NICHT abziehbar** → als Betriebsausgabe (Teil der Gesamtausgabe) gebucht — NOT separately in Zeile 65.

---

## 7. UStVA (Umsatzsteuervoranmeldung)

### 7.1 Who files

- Every Unternehmer with Regelbesteuerung (NOT Kleinunternehmer).
- Exemption: in the first two years of business, USt is monatlich zu melden (§18 Abs. 2 S. 4 UStG, formerly in effect until 2020; **temporarily suspended** for 2021–2026 by Bürokratieentlastungsgesetz III, so neue Gründer können auch vierteljährlich melden — see below).

### 7.2 Intervall (monatlich vs. vierteljährlich)

Per **§18 Abs. 2 UStG** (updated 2025):

| Zahllast Vorjahr | Intervall |
|---|---|
| > €9,000 | **monatlich** (up from €7,500 since 2025; **Wachstumschancengesetz**) |
| €2,000 – €9,000 | **vierteljährlich** |
| ≤ €2,000 | **jährlich** (Befreiung, §18 Abs. 2 S. 3 UStG) |
| Erstattungsbetrag (Vorsteuerüberhang) > €9,000 | monatlich (auf Antrag) |
| Neugründer (2021–2026 Sonderregelung) | **vierteljährlich** statt zwingend monatlich — letzte gesetzliche Lage prüfen |

**Gotcha**: die €9,000-Grenze wurde 2025 von €7,500 angehoben. Viele Kleinstunternehmer dürfen jetzt vierteljährlich melden → **Cashflow-Vorteil**.

**Dauerfristverlängerung** (§§46–48 UStDV): 1 Monat späterer Abgabetermin, Antrag einmalig; 1/11 der Vorjahres-USt-Zahllast als Sondervorauszahlung — für Monatsmelder.

### 7.3 Fristen

- Abgabe und Zahlung **bis zum 10. des Folgemonats** (§18 Abs. 1 UStG, §108 AO), mit Dauerfristverlängerung 10. des darauf folgenden Monats.
- Verspätete Abgabe → Verspätungszuschlag, Säumniszuschlag 1%/Monat.

### 7.4 Elektronische Abgabe via ELSTER

- **Mandatory** since 2005 (§18 Abs. 1 UStG). No Papier mehr (außer unbillige Härte mit Antrag).
- Format: XML via ERiC (Schema `datenabholung.xsd`, Gruppe UStVA).
- OSS (One Stop Shop) separat, siehe 10.5.

### 7.5 Vorsteuerabzug (§15 UStG)

- Vorsteuer nur abziehbar wenn:
  1. Eingangsrechnung erfüllt §14 UStG-Angaben (gotcha if supplier's invoice has a mistake).
  2. Leistung wurde für Unternehmen bezogen.
  3. Rechnung wurde VOR Abgabe der UStVA erhalten (bzw. Leistung erbracht).
- **Kein Vorsteuerabzug**:
  - Kleinunternehmer (kein Vorsteuer, kein Ausweis).
  - Leistungen für PKW (anteilig private Nutzung).
  - Bewirtung: 100% Vorsteuer (nicht 70%!), aber nur 70% als Betriebsausgabe ertragsteuerlich.
  - **Leistungen an Kleinunternehmer-Empfänger, falls Lieferant fälschlich USt ausweist** — §14c, kein Vorsteuerabzug.
- **Mindestinhalt der Eingangsrechnung**: per BFH-Rechtsprechung darf "Bezeichnung der Leistung" nicht zu pauschal sein ("Beratung" allein nicht ausreichend; "IT-Beratung für Projekt XYZ im März 2026" ok).

### 7.6 Zusammenfassende Meldung (ZM) — §18a UStG

- Für innergemeinschaftliche Warenlieferungen und Dienstleistungen B2B an EU-USt-IdNr.
- **Monatlich**, bei geringen Umsätzen vierteljährlich möglich.
- Abgabe bis zum 25. des Folgemonats.
- Auch für Kleinunternehmer, falls sie B2B-Dienstleistungen in EU Reverse-Charge abrechnen. **Overlooked**.

---

## 8. DATEV Export (EXTF)

### 8.1 Legal/market background

- DATEV is the de-facto bookkeeping standard for ~40% of all German SMEs via Steuerberater.
- Interchange format: **DATEV-Format** — CSV, semicolon-delimited, Windows-1252 encoding.
- Latest version: **EXTF 700/800 series**, current default **EXTF 700** ("Buchungsstapel"), also **EXTF 510** for legacy and **EXTF 800** for address data.
- Spec: "DATEV-Schnittstellen-Entwicklerportal" (registered developer required). Public summary available via the DATEV website; detailed spec via partner program.

### 8.2 File layout (Buchungsstapel)

File = 2 rows of **header** + n rows of **data**.

- **Row 1 — "Header Zeile"**: meta-fields, 47 columns, describing the file.
  - Col 1: `"EXTF"` (literal)
  - Col 2: `700` (version)
  - Col 3: `21` (Kategorie: 21 = Buchungsstapel)
  - Col 4: `"Buchungsstapel"`
  - Col 5: `7` (Format-Version — 7 = 2018+)
  - Col 6: Timestamp `YYYYMMDDhhmmss000`
  - Col 7: Imported date — empty
  - Col 8: Origin — `"RE"` (Rechnungswesen) or `"SV"` (Lohn) — for invoicing SaaS: `"RE"`.
  - Col 9: Exportiert von — free text max 25 chars
  - Col 10: Importiert von — empty
  - Col 11: Berater (DATEV-Berater-Nr., required)
  - Col 12: Mandant (DATEV-Mandant-Nr., required)
  - Col 13: WJ-Beginn `YYYYMMDD`
  - Col 14: Sachkontennummernlänge (4–8)
  - Col 15: Datum von `YYYYMMDD`
  - Col 16: Datum bis `YYYYMMDD`
  - Col 17: Bezeichnung (free text)
  - Col 18: Diktatkürzel (user initials, 2 chars)
  - Col 19: Buchungstyp (1 = Finanzbuchführung)
  - Col 20: Rechnungslegungszweck (0 = unabhängig)
  - Col 21: Festschreibung (0 = keine, 1 = festgeschrieben)
  - Col 22: WKZ (`"EUR"`)
  - Col 23–47: reserved/optional (Kontenrahmen-ID, SKR-Nr. etc.)

- **Row 2 — "Feldnamen Zeile"** (column headers for data rows):
  Examples:
  `"Umsatz (ohne Soll/Haben-Kz)";"Soll/Haben-Kennzeichen";"WKZ Umsatz";"Kurs";"Basis-Umsatz";"WKZ Basis-Umsatz";"Konto";"Gegenkonto (ohne BU-Schlüssel)";"BU-Schlüssel";"Belegdatum";"Belegfeld 1";"Belegfeld 2";"Skonto";"Buchungstext";"Postensperre";"Diverse Adressnummer";"Geschäftspartnerbank";"Sachverhalt";"Zinssperre";"Beleglink";...`

- **Row 3+ — data rows**: one per booking. 125 columns total in v7.

### 8.3 Mandatory data columns (minimum)

| Col # | Field | Notes |
|---|---|---|
| 1 | Umsatz | Gross amount, decimal comma, 2 decimals, e.g., `1190,00` |
| 2 | Soll/Haben-Kennzeichen | `S` or `H` |
| 3 | WKZ Umsatz | `EUR` |
| 7 | Konto | Sachkonto or Personenkonto (customer#) |
| 8 | Gegenkonto | The offsetting account |
| 9 | BU-Schlüssel | DATEV tax/posting key. See 8.4 |
| 10 | Belegdatum | `TTMM` (4 digits, year inferred from header!) |
| 11 | Belegfeld 1 | Invoice number |
| 12 | Belegfeld 2 | Optional (e.g., Fälligkeit) |
| 14 | Buchungstext | max 60 chars |
| 37 | EU-Mitgliedstaat u. USt-IdNr. | for EU B2B |
| 40 | Steuersatz | e.g., `19,00` |

### 8.4 BU-Schlüssel (tax keys) — SKR03 (most relevant examples)

| BU | Umsatzsteuer | Konto (Erlöse SKR03) |
|---|---|---|
| 0 | 0% (keine USt) | 8200 Erlöse Kleinunternehmer / 8120 Erlöse steuerfrei |
| 2 | 7% | 8300 Erlöse 7% USt |
| 3 | 19% | 8400 Erlöse 19% USt |
| 8 | Reverse-Charge §13b Abs. 2 Nr. X | 8336 / 8337 |
| 9 | Innergem. Lieferung steuerfrei | 8125 |

**Gotcha**: user must tell you their Steuerberater's preferred BU-key mapping. Provide a settings page.

### 8.5 Export best practices

- Filename: `EXTF_<yyyymmddhhmmss>_Buchungsstapel.csv` (DATEV recommended).
- Accompany with a separate `EXTF_*.csv` for each: Buchungsstapel, Debitoren/Kreditoren-Stammdaten, Belege (DUO folder).
- Zip with `bericht.xml` if delivering via DATEV Unternehmen online (DUO).
- **DATEV DUO / DATEVconnect online**: modern REST API — OAuth2, push bookings/documents directly to Steuerberater. Available to SaaS after DATEV partner registration. **Aim for DATEVconnect online certification** to cut down friction.

### 8.6 Alternatives (modern)

- **DATEV Unternehmen online (DUO)** upload.
- **DATEV Auftragswesen next** (invoicing module by DATEV itself — NB: competes with your SaaS).
- **buchhaltungsbutler.de / lexoffice.de / sevdesk.de / candis.io** use DATEV APIs under the hood.
- **Steuerberater-Portale** (e.g., counter.app, Taxdoo for e-commerce).

---

## 9. KSK (Künstlersozialkasse)

### 9.1 Scope

- **Künstlersozialversicherungsgesetz (KSVG)** regulates.
- Pays pension, health, nursing-care insurance for self-employed **Künstler und Publizisten**.
- Financed 50% by artist (contributions), 20% by federal subsidy, 30% by **Künstlersozialabgabe** paid by **Verwerter** (companies that use artistic/journalistic work).

### 9.2 Does it apply to a media agency?

**Yes, both directions**:

1. **As Verwerter** (client-of-freelancers): if the agency regularly commissions künstlerische/publizistische Leistungen (graphic design, copywriting, photography, web design, illustration, music etc.) from self-employed individuals, it pays **Künstlersozialabgabe** on the **Nettohonoraren**.
   - **Abgabepflicht** ab **€450/Jahr** Zahlungen an selbständige Künstler/Publizisten (§24 KSVG Bagatellgrenze — **raised to €450 since 2023**, confirm latest).
   - Abgabesatz 2025/2026: **5.0%** (was 5.0% 2024–2025; consult latest KSK-Bekanntmachung).
   - **Meldung**: jährlich bis **31. März** des Folgejahres (Formular "Jahresmeldung").
   - **Prüfung**: regelmäßig durch **Deutsche Rentenversicherung Bund** (5-Jahres-Rhythmus, Schwerpunktprüfung Agenturen!).
   - **Bußgeld**: bis €50,000 bei Verletzung §36 KSVG.

2. **As Künstler** (if the owner is personally active creatively): may apply for **KSK-Versicherung** → Kranken-/Pflege-/Rentenversicherung at employee-like conditions (50% contribution covered by KSK).

### 9.3 Abgabepflichtige Leistungen — key list for a media agency

Subject to Künstlersozialabgabe:
- Grafikdesign, Webdesign (selbständig).
- Texterstellung, Redaktion, Lektorat (journalistisch/publizistisch).
- Fotografie.
- Illustration.
- Filmproduktion, Videoschnitt (soweit künstlerisch).
- Übersetzungen (literarisch).
- Komponisten, Musiker.
- Moderation, Sprecher.

NOT subject:
- Druckkosten (außer reiner Gestaltungsanteil).
- Programmierung (reines Coding).
- Reine technische SEO.
- Lieferung von Sachleistungen (Hardware, Server).

**Gotcha**: Agenturen zahlen KSA auch auf **Leistungen von GbR/Agenturen** (wenn die Empfänger wiederum Künstler beschäftigen) — früher nur bei natürlichen Personen, heute teils auch bei Einzelunternehmen.

### 9.4 SaaS features

- Tag each expense line with "KSK-relevant: ja/nein".
- Year-end: generate KSK-Meldung per Formular "Meldung des abgabepflichtigen Entgelts" (PDF pre-fill).
- Alert: "diese Zahlungen an [Freelancer-Name] unterliegen KSK-Abgabe".

---

## 10. Other Requirements

### 10.1 Mahnwesen / Verzug (§§ 286–288 BGB)

- **Verzug** tritt ein **30 Tage nach Rechnungszugang UND Fälligkeit** bei Verbrauchern (mit Hinweis auf Rechnung), bei B2B **automatisch 30 Tage nach Fälligkeit** (§286 Abs. 3 BGB), oder sofort per Mahnung.
- **Verzugszinsen §288 BGB**:
  - **Verbraucher**: **Basiszinssatz + 5 %-Punkte** p.a.
  - **B2B**: **Basiszinssatz + 9 %-Punkte** p.a.
  - **Basiszinssatz 2026-01-01**: letzte Bekanntmachung Bundesbank (typisch 3,00–3,50% — bitte aktuellen Wert nachschlagen).
  - Beispiel: B2B, Basiszins 3,37% → 12,37 % p.a. Verzugszinsen.
- **Verzugspauschale §288 Abs. 5 BGB**: bei B2B pauschal **€40** pro überfälliger Forderung (zusätzlich zu Zinsen).
- **"3 Mahnstufen" sind rechtlich NICHT vorgeschrieben** — Verzug kann direkt nach Fälligkeit+30 Tage einsetzen. Geschäftsüblich:
  - **1. Mahnung** (höflich, Zahlungsfrist 7–10 Tage, oft kostenlos).
  - **2. Mahnung** (klar, Mahngebühr 2,50–5 €, Zinsen ab jetzt explizit).
  - **3. Mahnung / letzte Mahnung** (Ankündigung Mahnbescheid).
  - **Mahnbescheid** (§688 ff. ZPO — gerichtliches Mahnverfahren, Online-Antrag über [www.online-mahnantrag.de](https://www.online-mahnantrag.de)).
  - **Vollstreckungsbescheid** → Zwangsvollstreckung.
- **Mahngebühren**: Höhe nicht gesetzlich geregelt, "angemessen" (ca. 2,50–5,00 € für Porto + Aufwand). Überzogene Gebühren (z.B. 10 €) gelten als unwirksam.
- **Vertraglich individuelle Regelungen** (in AGB) sind möglich, müssen aber transparent sein.

**Product features**:
- Automatisches Zahlungserinnerungs- und Mahnwesen mit 3-stufigem Workflow.
- Verzugszinsen-Rechner mit tagesaktuellem Basiszinssatz.
- Mahnbescheid-Export (PDF für Online-Mahnantrag).

### 10.2 §28a AO / §145 AO — elektronische Bücher

- **§145 AO**: "Bücher und Aufzeichnungen sind so zu führen, dass sie einem sachverständigen Dritten innerhalb angemessener Zeit einen Überblick über die Geschäftsvorfälle und die Lage des Unternehmens vermitteln."
- **§146 AO**: Führen im Inland — seit 2025 mit Erleichterungen für Cloud innerhalb EU (§146 Abs. 2a neu).
- **§147 AO**: Aufbewahrung — siehe 3.2.
- Keine eigene Vorschrift "§28a" für Bücher; wahrscheinlich Verwechslung. §28a EStG → Sonderausgaben. Anonymisiert durchlaufen.

### 10.3 eIDAS und Elektronische Signaturen

- **eIDAS-Verordnung (EU) 910/2014**; Nachfolger **eIDAS 2.0 (EU-Verordnung 2024/1183)** für Wallets seit 2024.
- Für E-Rechnungen in DE ist **keine qualifizierte elektronische Signatur (QES) erforderlich** (siehe 2.9).
- **Wann QES trotzdem sinnvoll**:
  - Verträge, die Schriftform (§126a BGB) verlangen (z.B. Bürgschaft B2C) — nur QES substituiert Schriftform.
  - Public-sector tenders.
- **FES (Fortgeschrittene el. Signatur)** und **SES (Einfache el. Sig.)** reichen oft — relevant z.B. für DocuSign, SignRequest, Inkubate.
- **Anbieter QES**: Bundesdruckerei **D-Trust**, **Swisscom Trust Services**, **InCert GmbH**.

### 10.4 OSS (One Stop Shop) — EU B2C cross-border

- Seit 2021-07-01.
- Gilt für: **B2C Lieferungen und Dienstleistungen** in anderen EU-Ländern (Fernverkauf Waren, digitale Dienstleistungen an Verbraucher).
- **Lieferschwelle**: unified **€10,000/Jahr EU-weit** (§3c UStG). Darüber: Verbraucherortsregel → USt des Ziellands geschuldet.
- **Vereinfachung OSS**: statt in jedem EU-Land registrieren zu müssen, zentral über BZSt portal melden, alle EU-USten auf einmal.
- Meldungen **quartalsweise** über **BZSt-OSS-Portal** (ELSTER/BZSt Online).
- Für Media-Agency üblich: **elektronische Dienstleistungen an EU-Verbraucher** (z.B. Online-Kurse, Software-Subscriptions an C) → OSS relevant.
- **Gotcha**: B2B Dienstleistungen laufen NICHT über OSS — die laufen über Reverse Charge §13b.
- **IOSS** (Import One Stop Shop) für Waren < €150 aus Drittländern — für Media-Agentur meist irrelevant.

### 10.5 Bauabzugsteuer §48 EStG

- Wenn Auftraggeber (Bauherr) ein Unternehmer/Juristische Person ist und Bauleistungen bezieht → **15% Bauabzugsteuer** einzubehalten und an FA abzuführen.
- Ausnahme: Leistungserbringer hat **Freistellungsbescheinigung** nach **§48b EStG** (BZSt-Bescheinigung, Gültigkeitsprüfung online).
- **Relevant für Media-Agency selten** — außer Agentur mietet/renoviert Studio und Bauleistung > €5.000 (Bagatellgrenze §48 EStG bei Vermietern nicht-U/nicht-bauend anders).
- Zusätzlich zu **§13b Reverse Charge USt** (beide parallel prüfen).

### 10.6 Minijob / Gewerbeanmeldung

- **Gewerbeanmeldung** (§14 GewO): bei Gemeinde (Bürgeramt), Pflicht für **Gewerbetreibende** (nicht Freiberufler §18 EStG).
- **Freiberufler**: nur Anmeldung beim Finanzamt (Fragebogen zur steuerlichen Erfassung, online über ELSTER).
- **Minijob**: Geringfügigkeitsgrenze 2025: **€556/Monat** (seit 2024-01-01 dynamisch an Mindestlohn gekoppelt; Mindestlohn 2026: **€13,25/h** → €556 aktuell, 2026 ggf. höher — prüfen).
- Für Agentur relevant: falls Minijob-Angestellten geführt → Meldung bei **Minijob-Zentrale** (Knappschaft-Bahn-See).
- **Kurzfristige Beschäftigung**: max **70 AT/Jahr** oder **3 Monate**, keine Dauerhaftigkeit.

### 10.7 Gewerbesteuer

- **Freibetrag €24,500** für Einzelunternehmer/Personen-Gesellschaften.
- **Messzahl 3.5 %** × Gewerbeertrag × **Hebesatz Gemeinde** (200–580%).
- Anrechnung auf ESt (§35 EStG) bis 4,0 × Messbetrag = praktisch neutral bis Hebesatz ~400%.
- Freiberufler: **keine Gewerbesteuer**.
- Filing: **GewSt-Erklärung** via ELSTER, jährlich.

---

## 11. Certifications a SaaS Might Want/Need

### 11.1 Must-have (year 1–2)

- **DSGVO-Compliance Statement** (self-attestation + Datenschutzerklärung on website).
- **AV-Vertrag-Template** (Art. 28 DSGVO) — pre-signed for user flow.
- **Verfahrensdokumentation-Template** für Kunden (GoBD 10.1).

### 11.2 High-value (year 2–3)

- **ISO/IEC 27001:2022** — Informationssicherheits-Managementsystem. Certified by DAkkS-akkreditierter Zertifizierer (TÜV SÜD, TÜV Rheinland, BSI, DNV, DEKRA).
  - Cost: €30–€80k initial (Aufwand + externer Auditor), €10–€20k/Jahr Surveillance. Lead time 9–15 Monate.
- **SOC 2 Type II** — for US market, aber auch gerne gesehen von DE-Corporate-Kunden. AICPA standard, audited by US CPA (in DE: Mazars, KPMG, PwC — sind alle akkreditiert). Cost: €40–€80k.
- **IDW PS 951 / ISAE 3402** — Service Organization Report, oft für Finanzdienstleister-Kunden gefordert.

### 11.3 GoBD-Testat / IDW PS 880

- **IDW PS 880** — "Prüfung von Softwareprodukten". Testat eines WP, dass die Software grundsätzlich GoBD-konform genutzt werden kann.
- Anbieter: PwC, KPMG, EY, Deloitte, Audicon/IDEA (Sonderrolle bei Datenexport), Mazars, Ebner Stolz, WTS.
- **Kosten**: €30–€80k initial, €20–€40k p.a. Follow-up.
- **Nutzen**: Dealbreaker für Steuerberater-Kooperationen; Marketing-Trust.

### 11.4 DIN SPEC 91388

- **DIN SPEC 91388** — "Elektronische Rechnungen – Konformitätsprüfung" (bzw. E-Rechnungs-Spezifikation; Titel varriert).
- Konformitätsprüfung, dass E-Rechnungs-Software EN 16931-konform produziert.
- Publikation DIN, niedrige Zertifizierungsdichte, aber als **Marketing-Signal** nice — aktuell begrenzter Nutzen.
- Alternativ **FeRD-Konformitätsnachweis für ZUGFeRD**: auf der FeRD-Website kann Software als "ZUGFeRD 2.x Konform" gelistet werden nach Testdaten-Validierung (Mustang-Project Validator).
- **KoSIT XRechnung-Testsuite**: offizielle Konformitätssuite für XRechnung — führen, bestehen, auf Website kommunizieren.

### 11.5 Branch-specific add-ons

- **BSI C5** — Cloud Computing Compliance Criteria Catalogue — für Cloud-Vendor, öffentlich Sektor Kunden. Hoch im Wert für DE.
- **TISAX** — Automotive industry. Irrelevant für media agencies.
- **DIN ISO 14001 / EMAS** — Umweltmanagement. Nice-to-have, nicht relevant.

---

## 12. Reporting summary of 2024–2026 CHANGES (change-log)

| Date | Change | Impact |
|---|---|---|
| **2024-03-27** | Wachstumschancengesetz (BGBl. I 2024 Nr. 108) — E-Rechnungs-Pflicht einführt | B2B: Empfangspflicht 2025-01-01, Sendepflicht 2027/2028 |
| **2024-03-27** | Buchführungspflicht-Grenzen §141 AO angehoben auf €80k Gewinn / €800k Umsatz | Mehr EÜR-Fälle statt Bilanz |
| **2024-10-15** | BMF-Schreiben "Anwendung und Übergangsregeln E-Rechnung" (GZ III C 2 - S 7287-a/23/10001 :007) | Auslegungsleitfaden |
| **2024-12-06** | Bürokratieentlastungsgesetz IV (BGBl. I 2024 Nr. 323) | Aufbewahrung 10→8 Jahre |
| **2024-12-20** | Jahressteuergesetz 2024 (BGBl. I 2024 Nr. 387) | Kleinunternehmer: €25k/€100k Grenzen, Steuerfreiheit-Charakter, §19a EU-Kleinunternehmer |
| **2025-01-01** | **E-Rechnungs-Empfangspflicht** live | Every B2B recipient must receive |
| **2025-01-01** | Kleinunternehmer neue Grenzen | Mehr Freelancer fallen rein |
| **2025-01-01** | UStVA-Grenzen angehoben (€9k monatlich) | Viele werden Quartals-Melder |
| **2025-03-11** | EU VAT in the Digital Age (ViDA) beschlossen | Pfad Richtung 2030 EU-E-Invoicing |
| **2026-Q? (erwartet)** | DE E-Rechnungs-Format-Standard-Update (XRechnung 3.1/4.0) | Produktpflege |
| **2027-01-01** | Sendepflicht > €800k Vorjahresumsatz | Enterprise-Segment betroffen |
| **2028-01-01** | Sendepflicht alle B2B | Dealbreaker |
| **2030 (EU ViDA)** | EU-weite cross-border DRR (Digital Reporting) | Real-time reporting required |

---

## 13. Product-design checklist (operational take-aways)

### 13.1 Core invoicing pipeline

- [ ] Append-only invoice store, hash-chained per tenant.
- [ ] Generate XRechnung 3.x + ZUGFeRD 2.3 EN 16931 on every invoice.
- [ ] KoSIT-Validator + veraPDF in CI/CD, on every render.
- [ ] BT-130 unit-code dropdown (UN/ECE Rec 20).
- [ ] Validate seller's USt-IdNr. via BZSt web-service qualifizierte Bestätigung.
- [ ] Email delivery + download portal + (optional) Peppol access point.
- [ ] Per-tenant setting: numbering circles, SKR03/04, Kleinunternehmer yes/no.
- [ ] Kleinunternehmer guard: block VAT fields, default § 19 notice.
- [ ] Storno workflow creates new invoice, preserves original.
- [ ] Sequence-gap reporting for audit.

### 13.2 GoBD pipeline

- [ ] XML (and PDF) immutable in object-store with Object Lock.
- [ ] Verfahrensdokumentation-Vorlage für Kunden (PDF + Markdown), downloadbar.
- [ ] Einzelner "GoBD-Audit-Export"-Button → erzeugt Zip mit index.xml + CSV je Tabelle + Originaldokumente + Hash-Chain.
- [ ] 8-Jahre-Retention als Default, UI-Hinweis.
- [ ] Audit-Log separat exportierbar.

### 13.3 DSGVO pipeline

- [ ] EU hosting by default.
- [ ] Sub-processor list öffentlich.
- [ ] DPA (Art. 28) one-click signature.
- [ ] Export (Art. 20) and Delete (Art. 17) self-service.
- [ ] Cookie-CMP without tracking by default (or consent-first).

### 13.4 EKS / Bürgergeld

- [ ] Dualer Kontenrahmen: EÜR + EKS.
- [ ] SA40-PDF-Generator.
- [ ] Monatliche Vorläufig + End-of-BWZ-Abrechnung.
- [ ] KFZ-Pauschale €0.10/km Support.

### 13.5 EÜR / UStVA / DATEV

- [ ] ERiC-Bridge für UStVA + Anlage EÜR via ELSTER.
- [ ] DATEV EXTF 700 Export (CSV).
- [ ] DATEVconnect online API (later).
- [ ] SKR03 + SKR04 Zuordnung.

### 13.6 Mahn / Zahlung

- [ ] 3-stufiger Mahn-Workflow.
- [ ] §288 BGB Zinsrechner mit live Basiszins.
- [ ] Verzugspauschale €40 automatic.
- [ ] Export "Online-Mahnantrag"-PDF.

### 13.7 KSK

- [ ] Flag "KSK-abgabepflichtig" auf Ausgaben-Positionen.
- [ ] Jahres-Report für KSK-Meldung (bis 31.03.).

### 13.8 OSS / EU

- [ ] Kennzeichnung B2C EU.
- [ ] OSS-Report Quartal (BZSt-Schema).
- [ ] USt-IdNr.-Check (BZSt).

---

## 14. Gotchas that will KILL a SaaS (prioritized)

1. **Nicht-unveränderbare Speicherung** → Finanzamt-Beanstandung → Steuerberater-Käufer verlieren, PR-Krise.
2. **E-Rechnung-Generierung ist "PDF mit embedded XML, das nie validiert wird"** → ZUGFeRD-Profil "Extended" statt "EN 16931" ausgewiesen, BMF lehnt ab. Immer validieren.
3. **Kleinunternehmer-UI zeigt noch USt-Felder** → User füllt versehentlich aus → §14c-Schuld.
4. **Invoice-Nummer kann im Frontend gelöscht werden** → Lücke → Betriebsprüfung kritisch.
5. **Daten auf US-Server (Supabase us-east default, Vercel, Firebase)** → Kunden-DPA-Review fliegt raus.
6. **Keine Export-Funktion (Art. 20 DSGVO, §147 AO)** → Kunde kündigt, data locked in → Klage.
7. **"3 Mahnstufen" als Pflicht kommuniziert** → Falsch (rechtlich nicht nötig), User verliert Zeit.
8. **ERiC-Bridge nicht registriert/zertifiziert** → UStVA schlägt fehl, User blaimed SaaS.
9. **Retention 10 Jahre fest-codiert** → nach BEG IV veraltet.
10. **Kein Visual-Render für empfangene XRechnungen** → User sieht XML → "nicht akzeptabel" → Churn.
11. **Verzugszinsen hardcoded** → Basiszinssatz halbjährlich; ändert sich 2x/Jahr; User wundert sich.
12. **SEPA-XML-Export fehlt** → Steuerberater export will CSV, aber SEPA-Lastschrift fehlt.
13. **Kein Multi-Mandanten** → Steuerberater will mehrere Mandanten pro Login.
14. **Zwei-Faktor fehlt/optional** → Corporate Buyer lehnt ab.
15. **Keine Open Data-Export API** → Enterprise-Kunde geht weg wegen Vendor Lock-in.

---

## 15. References (primary)

- **UStG / UStDV**: [gesetze-im-internet.de/ustg_1980](https://www.gesetze-im-internet.de/ustg_1980/) and [gesetze-im-internet.de/ustdv_1980](https://www.gesetze-im-internet.de/ustdv_1980/)
- **EStG**: [gesetze-im-internet.de/estg](https://www.gesetze-im-internet.de/estg/)
- **AO**: [gesetze-im-internet.de/ao_1977](https://www.gesetze-im-internet.de/ao_1977/)
- **HGB**: [gesetze-im-internet.de/hgb](https://www.gesetze-im-internet.de/hgb/)
- **SGB II**: [gesetze-im-internet.de/sgb_2](https://www.gesetze-im-internet.de/sgb_2/)
- **Bürgergeld-V**: [gesetze-im-internet.de/alg_iiv_2008](https://www.gesetze-im-internet.de/alg_iiv_2008/)
- **KSVG**: [gesetze-im-internet.de/ksvg](https://www.gesetze-im-internet.de/ksvg/)
- **BDSG**: [gesetze-im-internet.de/bdsg_2018](https://www.gesetze-im-internet.de/bdsg_2018/)
- **TDDDG / TTDSG**: [gesetze-im-internet.de/tddddg](https://www.gesetze-im-internet.de/tddddg/)
- **DSGVO**: [eur-lex.europa.eu/eli/reg/2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- **BMF Startpunkt E-Rechnung**: [bundesfinanzministerium.de/.../e-rechnung.html](https://www.bundesfinanzministerium.de/Content/DE/FAQ/e-rechnung.html)
- **BMF GoBD**: "BMF-Schreiben vom 28.11.2019 (GZ IV A 4 - S 0316/19/10003 :001)" mit Nachführungen 2024
- **KoSIT XRechnung**: [xoev.de/xrechnung](https://www.xoev.de/xrechnung) / [github.com/itplr-kosit](https://github.com/itplr-kosit)
- **FeRD ZUGFeRD**: [ferd-net.de](https://www.ferd-net.de/)
- **EN 16931**: CEN Technical Committee 434 (purchase required for full spec; overview public)
- **ELSTER/ERiC**: [elster.de](https://www.elster.de/elsterweb/start)
- **DATEV Entwicklerportal**: [developer.datev.de](https://developer.datev.de/)
- **Peppol**: [peppol.org](https://peppol.org/) / [xoev.de/peppol](https://xoev.de/) — German Peppol Authority
- **BZSt USt-IdNr. qualifizierte Bestätigung**: [bzst.de](https://www.bzst.de/)
- **KSK**: [kuenstlersozialkasse.de](https://www.kuenstlersozialkasse.de/)
- **BA / Jobcenter**: [arbeitsagentur.de/jobcenter-digital](https://www.arbeitsagentur.de/jobcenter-digital)
- **Bundesbank Basiszinssatz**: [bundesbank.de/basiszinssatz](https://www.bundesbank.de/)
- **Bürokratieentlastungsgesetz IV**: BGBl. I 2024 Nr. 323
- **Wachstumschancengesetz**: BGBl. I 2024 Nr. 108
- **Jahressteuergesetz 2024**: BGBl. I 2024 Nr. 387

---

## Appendix A — XRechnung minimal example (CII)

A minimum XRechnung 3.0 CII invoice for a media agency consulting engagement, Kleinunternehmer scenario:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
    xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
    xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
    xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter>
      <ram:ID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</ram:ID>
    </ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>2026-RE-00123</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260424</udt:DateTimeString></ram:IssueDateTime>
    <ram:IncludedNote>
      <ram:Content>Kein Steuerausweis aufgrund Anwendung der Kleinunternehmerregelung nach § 19 UStG.</ram:Content>
    </ram:IncludedNote>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>Konzeption Social-Media-Kampagne</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>85.00</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="HUR">12</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>E</ram:CategoryCode>
          <ram:RateApplicablePercent>0</ram:RateApplicablePercent>
          <ram:ExemptionReason>Kleinunternehmerregelung §19 UStG</ram:ExemptionReason>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>1020.00</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>Mustermedia Agentur, Inhaber Max Muster</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>10115</ram:PostcodeCode>
          <ram:LineOne>Musterstraße 1</ram:LineOne>
          <ram:CityName>Berlin</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="FC">12/345/67890</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>Beispielkunde GmbH</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>80331</ram:PostcodeCode>
          <ram:LineOne>Kundenweg 5</ram:LineOne>
          <ram:CityName>München</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime><udt:DateTimeString format="102">20260420</udt:DateTimeString></ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>0</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>1020.00</ram:BasisAmount>
        <ram:CategoryCode>E</ram:CategoryCode>
        <ram:RateApplicablePercent>0</ram:RateApplicablePercent>
        <ram:ExemptionReason>Kleinunternehmerregelung §19 UStG</ram:ExemptionReason>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>1020.00</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>1020.00</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">0</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>1020.00</ram:GrandTotalAmount>
        <ram:DuePayableAmount>1020.00</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
```

Category code `E` = Exempt (used for Kleinunternehmer §19 UStG). For **Reverse Charge B2B EU services**, use `AE` with `ExemptionReason = "Steuerschuldnerschaft des Leistungsempfängers"` and set the Buyer's VAT ID.

---

## Appendix B — Glossary (ready-to-use in UI copy)

- **E-Rechnung** — structured electronic invoice per EN 16931.
- **sonstige Rechnung** — non-structured (PDF, paper, image) — transitional use only.
- **XRechnung** — DE public sector standard; pure CII/UBL XML.
- **ZUGFeRD** — hybrid PDF/A-3 + CII XML.
- **Leitweg-ID** — routing ID for public sector E-Rechnungen.
- **Peppol** — EU-standard network for e-procurement/e-invoicing.
- **Kleinunternehmer** — VAT-small-business per §19 UStG.
- **Umsatzsteuer-Identifikationsnummer (USt-IdNr.)** — format `DE123456789`.
- **Steuernummer** — format `12/345/67890` (Bundesland-specific).
- **Leistungsdatum** — date of performance; required on every §14 invoice.
- **Gutschrift (§14 UStG)** — self-billing document (recipient issues invoice).
- **(kaufmännische) Gutschrift** — credit note reducing a receivable.
- **Storno** — cancellation (colloquial), implemented as new negative invoice.
- **EÜR** — Einnahmen-Überschuss-Rechnung (§4 Abs. 3 EStG cash-basis P&L).
- **UStVA** — Umsatzsteuer-Voranmeldung (monthly/quarterly VAT return).
- **ZM** — Zusammenfassende Meldung (intra-EU supply summary).
- **OSS / IOSS** — One Stop Shop / Import OSS (EU B2C registrations).
- **EKS** — Erklärung zum Einkommen aus selbständiger Tätigkeit (Jobcenter).
- **Bewilligungszeitraum (BWZ)** — benefit approval period.
- **GoBD** — Grundsätze ordnungsmäßiger Buchführung (digital).
- **Verfahrensdokumentation (VDok)** — documentation of data-processing procedures.
- **Datenträgerüberlassung Z3** — machine-readable export for tax auditor.
- **ERiC** — ELSTER Rich Client library.
- **SKR03 / SKR04** — DATEV standard charts of accounts.
- **DATEV EXTF** — DATEV CSV export format (Buchungsstapel).
- **KSK** — Künstlersozialkasse (artists' social insurance).
- **DSB** — Datenschutzbeauftragter.
- **AV-Vertrag** — Auftragsverarbeitungsvertrag (DPA).
- **TOM** — technische/organisatorische Maßnahmen.
- **DPF** — Data Privacy Framework (EU-US adequacy).

---

> End of report. All prices, thresholds and percentages are as of **April 2026**; monitor the following feeds for change:
> - BMF Monats-Newsletter
> - Bundesanzeiger (BGBl. announcements)
> - DATEV Fach-Info Steuern
> - KoSIT Mailingliste XRechnung
> - FeRD Newsletter ZUGFeRD
> - Bundesbank Basiszinssatz (jeweils 1. Januar / 1. Juli)
