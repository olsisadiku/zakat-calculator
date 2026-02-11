import { useState, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FieldDef {
  id: string;
  label: string;
  tooltip?: string;
}

interface FieldGroup {
  title: string;
  fields: FieldDef[];
}

interface WorksheetData {
  [key: string]: number;
}

const STORAGE_KEY = "zakat-calculator-data";
const TROY_OZ_TO_GRAMS = 31.1035;
const SILVER_CACHE_KEY = "zakat-silver-price";
const SILVER_CACHE_MAX_AGE = 1000 * 60 * 60; // 1 hour

const FONT_UI = '"DM Sans", system-ui, sans-serif';
const FONT_DISPLAY = '"Cormorant Garamond", Georgia, serif';

// ─── Field Definitions ───────────────────────────────────────────────────────

const assetsFields: FieldDef[] = [
  { id: "cash_on_hand", label: "Cash on hand" },
  { id: "checking", label: "Checking accounts" },
  { id: "savings", label: "Savings accounts" },
  {
    id: "gold", label: "Gold (value in currency)",
    tooltip: "Add up all your gold — jewelry, coins, bars. Only count the pure gold content, not the total weight of mixed items. Look up today's gold price per gram and multiply by your total pure gold weight.",
  },
  { id: "silver", label: "Silver (value in currency)" },
  {
    id: "active_investments", label: "Active investments",
    tooltip: "Investments you actively trade — stocks, ETFs, or funds bought and sold within the past year. Enter their full market value today.",
  },
  {
    id: "passive_investments", label: "Passive investments (CRI)",
    tooltip: "Long-term investments (held over 1 year) that you don't actively trade. With the CRI method, you only count about 30% of the market value. Example: If your index fund is worth $10,000, enter $3,000.",
  },
  {
    id: "dividends", label: "Dividend earnings",
    tooltip: "Cash payments companies pay you for owning their stock. Check your brokerage account for total dividends received this year.",
  },
  {
    id: "capital_gains", label: "Capital gains on sales",
    tooltip: "Profit from selling an asset for more than you paid. Example: Bought shares for $1,000, sold for $1,500 — your capital gain is $500.",
  },
  {
    id: "retirement_401k", label: "401(k) / pension",
    tooltip: "Two approaches: (1) Include the full balance minus early-withdrawal penalties and taxes. (2) Enter $0 now and pay Zakat when you actually withdraw the money in retirement.",
  },
  {
    id: "retirement_ira", label: "IRA / Roth IRA",
    tooltip: "Same two approaches as 401(k). Choose Approach 1 to pay Zakat now on the full value, or Approach 2 to defer Zakat until you withdraw.",
  },
  {
    id: "education_accounts", label: "Education accounts (529, ESA)",
    tooltip: "529 plans, Coverdell ESAs, and similar accounts. Only include if the funds won't be used for education. If your child is currently using it for school, enter $0.",
  },
  {
    id: "hsa", label: "Health Savings Account (HSA)",
    tooltip: "Unlike FSAs, HSA balances roll over every year and the money is permanently yours. Include the full balance.",
  },
  {
    id: "real_estate_market", label: "Real estate (on market)",
    tooltip: "Only properties you are actively trying to sell right now. Your personal home, vacation home, and rental properties you plan to keep are not included here.",
  },
  {
    id: "rental_income", label: "Rental income",
    tooltip: "Your net rental profit: total rent collected minus property expenses like repairs, management fees, and maintenance costs.",
  },
  { id: "cryptocurrency", label: "Cryptocurrency" },
  {
    id: "nfts_digital", label: "NFTs & digital assets",
    tooltip: "Digital assets like NFTs. If held for trade or sale, use their current market value. Personal-use digital items may be exempt.",
  },
  {
    id: "business_inventory", label: "Business inventory",
    tooltip: "Products in stock that haven't been sold or committed under contract. Don't include equipment, tools, or raw materials you use to run the business.",
  },
  {
    id: "accounts_receivable", label: "Accounts receivable",
    tooltip: "Money that customers or clients owe you that you can reasonably expect to collect. Don't include debts you've written off as uncollectable.",
  },
  {
    id: "good_debt", label: "Good debt owed to you",
    tooltip: "Money you've lent to someone who is able and expected to pay it back. Don't include money you don't realistically expect to recover.",
  },
  { id: "other_assets", label: "Other liable assets" },
];

const haramFields: FieldDef[] = [
  {
    id: "equity_haram", label: "Equity haram earnings",
    tooltip: "Your share of a company's prohibited income (like interest or alcohol revenue). Formula: (Company's prohibited income ÷ Total shares outstanding) × Your shares. \"Shares outstanding\" means the total number of shares a company has issued — you can find this on Yahoo Finance or Google Finance under the stock's key statistics.",
  },
  {
    id: "dividend_haram", label: "Dividend haram earnings",
    tooltip: "The prohibited portion of dividends you received. Formula: (Company's prohibited income ÷ Company's total revenue) × Your dividend. Example: If 5% of a company's revenue is from prohibited sources and you received $200 in dividends, enter $10.",
  },
  {
    id: "bond_interest", label: "Bond / interest earnings",
    tooltip: "All interest earned from bonds, CDs, money market funds, or savings accounts. Interest income (riba) is considered impermissible and must be removed from your wealth.",
  },
];

const expenseFields: FieldDef[] = [
  { id: "rent_mortgage", label: "Rent / mortgage (1 month)" },
  { id: "medical", label: "Medical expenses" },
  { id: "groceries", label: "Groceries & household" },
  { id: "utilities", label: "Utilities & telecom" },
  { id: "transport", label: "Transportation & fuel" },
  { id: "insurance", label: "Insurance payments" },
  {
    id: "property_tax", label: "Property taxes (period-due)",
    tooltip: "Only enter the portion that's currently due — not your full annual tax bill. Example: If your annual property tax is $6,000 paid quarterly, enter $1,500.",
  },
  {
    id: "delinquent_tax", label: "Delinquent taxes & fines",
    tooltip: "Overdue taxes, unpaid parking or traffic tickets, court fines, or government penalties you currently owe.",
  },
  {
    id: "debts_owed", label: "Debts owed (immediately due)",
    tooltip: "Only debts with payments due right now — this month's credit card minimum, a loan installment due today, etc. Don't enter your total mortgage balance or total student loan amount.",
  },
  { id: "other_expenses", label: "Other deductible expenses" },
];

// ─── Grouped Fields ──────────────────────────────────────────────────────────

const assetGroups: FieldGroup[] = [
  { title: "Cash & Bank Accounts", fields: assetsFields.slice(0, 3) },
  { title: "Precious Metals", fields: assetsFields.slice(3, 5) },
  { title: "Investments", fields: assetsFields.slice(5, 9) },
  { title: "Retirement & Savings", fields: assetsFields.slice(9, 13) },
  { title: "Property", fields: assetsFields.slice(13, 15) },
  { title: "Digital Assets", fields: assetsFields.slice(15, 17) },
  { title: "Business & Other", fields: assetsFields.slice(17) },
];

const expenseGroups: FieldGroup[] = [
  { title: "Monthly Living Expenses", fields: expenseFields.slice(0, 6) },
  { title: "Taxes, Debts & Other", fields: expenseFields.slice(6) },
];

// ─── Utility ─────────────────────────────────────────────────────────────────

function sumFields(data: WorksheetData, fields: FieldDef[]): number {
  return fields.reduce((sum, f) => sum + (data[f.id] || 0), 0);
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex items-center ml-1"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setShow(true); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setShow(false); }}
    >
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[11px] font-bold inline-flex items-center justify-center hover:bg-forest-500 hover:text-white transition-colors cursor-help"
        aria-label="More info"
      >
        ?
      </button>
      {show && (
        <>
          <div className="fixed inset-0 z-[9998] sm:hidden" onClick={() => setShow(false)} />
          <span
            role="tooltip"
            className="fixed sm:absolute left-4 right-4 bottom-4 sm:left-1/2 sm:right-auto sm:bottom-full sm:-translate-x-1/2 sm:mb-2 sm:w-72 p-4 bg-gray-900 text-white text-[13px] rounded-lg shadow-xl z-[9999] leading-relaxed"
            style={{ fontFamily: FONT_UI }}
          >
            {text}
            <span className="hidden sm:block absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-gray-900" />
            <span className="hidden sm:block absolute left-0 right-0 -bottom-3 h-3" />
          </span>
        </>
      )}
    </span>
  );
}

function StepIndicator({
  steps,
  current,
  onNavigate,
}: {
  steps: string[];
  current: number;
  onNavigate: (i: number) => void;
}) {
  return (
    <nav
      className="flex gap-1 mb-8 sm:mb-10 bg-gray-100 rounded-lg p-1"
      style={{ fontFamily: FONT_UI }}
    >
      {steps.map((label, i) => (
        <button
          key={label}
          onClick={() => onNavigate(i)}
          className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3 px-1 sm:px-2 rounded-md text-sm font-semibold transition-all
            ${i === current
              ? "bg-white text-gray-900 shadow-sm"
              : i < current
                ? "text-forest-600 hover:bg-white/60 cursor-pointer"
                : "text-gray-400"
            }`}
        >
          <span
            className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
              ${i === current || i < current
                ? "bg-forest-600 text-white"
                : "bg-gray-300 text-white"
              }`}
          >
            {i < current ? "✓" : i + 1}
          </span>
          <span className="text-[10px] sm:text-sm leading-tight text-center">{label}</span>
        </button>
      ))}
    </nav>
  );
}

function LedgerField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: number;
  onChange: (id: string, val: number) => void;
}) {
  const [displayValue, setDisplayValue] = useState(value ? String(value) : "");

  useEffect(() => {
    setDisplayValue(value ? String(value) : "");
  }, [value]);

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 py-3 sm:py-3.5 px-4 sm:px-5 border-b border-gray-100 last:border-b-0"
    >
      <label
        htmlFor={field.id}
        className="text-sm sm:text-[15px] font-medium text-gray-700 cursor-pointer flex items-center gap-0.5 min-w-0"
        style={{ fontFamily: FONT_UI }}
      >
        <span className="break-words sm:truncate">{field.label}</span>
        {field.tooltip && <InfoTooltip text={field.tooltip} />}
      </label>
      <div className="relative shrink-0">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"
          style={{ fontFamily: FONT_UI }}
        >
          $
        </span>
        <input
          id={field.id}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, "");
            setDisplayValue(raw);
            onChange(field.id, parseFloat(raw) || 0);
          }}
          onBlur={() => {
            const num = parseFloat(displayValue) || 0;
            setDisplayValue(num ? String(num) : "");
          }}
          placeholder="0.00"
          className="w-full sm:w-40 pl-7 pr-3 py-2 text-right text-base bg-white border border-gray-300 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-500"
          style={{ fontFamily: FONT_UI }}
        />
      </div>
    </div>
  );
}

function FieldSection({
  title,
  fields,
  data,
  onChange,
}: {
  title: string;
  fields: FieldDef[];
  data: WorksheetData;
  onChange: (id: string, val: number) => void;
}) {
  return (
    <div className="mb-6">
      <h3
        className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 px-1"
        style={{ fontFamily: FONT_UI }}
      >
        {title}
      </h3>
      <div className="bg-white rounded-lg border border-gray-200">
        {fields.map((field) => (
          <LedgerField
            key={field.id}
            field={field}
            value={data[field.id] || 0}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

function WorksheetTotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div
      className="flex items-center justify-between py-4 sm:py-5 px-4 sm:px-6 bg-forest-800 text-white rounded-lg mt-2"
      style={{ fontFamily: FONT_UI }}
    >
      <span className="text-sm sm:text-base font-semibold">{label}</span>
      <span className="text-xl sm:text-2xl font-bold tabular-nums">${fmt(amount)}</span>
    </div>
  );
}

function SummaryRow({
  label,
  amount,
  prefix = "",
  bold = false,
  accent,
  tooltip,
}: {
  label: string;
  amount: number;
  prefix?: string;
  bold?: boolean;
  accent?: "red" | "green";
  tooltip?: string;
}) {
  const textColor = accent === "red" ? "text-red-600" : accent === "green" ? "text-forest-600" : "text-gray-800";

  return (
    <div
      className={`flex items-center justify-between gap-2 py-3 sm:py-3.5 px-4 sm:px-5 ${bold ? "bg-gray-50" : ""}`}
      style={{ fontFamily: FONT_UI }}
    >
      <span className={`text-[13px] sm:text-[15px] ${bold ? "font-bold" : "font-medium"} ${textColor} flex items-center gap-0.5 min-w-0`}>
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      <span className={`text-[13px] sm:text-[15px] tabular-nums shrink-0 ${bold ? "font-bold sm:text-lg" : "font-semibold"} ${textColor}`}>
        {prefix}${fmt(amount)}
      </span>
    </div>
  );
}

// ─── Main Calculator ─────────────────────────────────────────────────────────

export default function ZakatCalculator() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WorksheetData>({});
  const [nisabPrice, setNisabPrice] = useState(0);
  const [nisabDisplay, setNisabDisplay] = useState("");
  const [heldOneYear, setHeldOneYear] = useState(false);
  const [useGregorian, setUseGregorian] = useState(false);
  const [silverFetchStatus, setSilverFetchStatus] = useState<
    "idle" | "loading" | "fetched" | "error"
  >("idle");
  const [silverUserEdited, setSilverUserEdited] = useState(false);
  const [silverPriceConfirmed, setSilverPriceConfirmed] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setData(parsed.data || {});
        setNisabPrice(parsed.nisabPrice || 0);
        setNisabDisplay(parsed.nisabPrice ? String(parsed.nisabPrice) : "");
        setHeldOneYear(parsed.heldOneYear || false);
        setUseGregorian(parsed.useGregorian || false);
        if (parsed.nisabPrice) setSilverUserEdited(true);
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto-fetch silver price
  useEffect(() => {
    async function fetchSilverPrice() {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nisabPrice) return;
      }

      try {
        const cached = localStorage.getItem(SILVER_CACHE_KEY);
        if (cached) {
          const { pricePerGram, fetchedAt } = JSON.parse(cached);
          if (Date.now() - fetchedAt < SILVER_CACHE_MAX_AGE && pricePerGram > 0) {
            const rounded = Math.round(pricePerGram * 10000) / 10000;
            setNisabPrice(rounded);
            setNisabDisplay(String(rounded));
            setSilverFetchStatus("fetched");
            return;
          }
        }
      } catch {
        // ignore cache errors
      }

      setSilverFetchStatus("loading");
      try {
        const res = await fetch("https://api.metals.live/v1/spot");
        if (!res.ok) throw new Error("API error");
        const json = await res.json();
        const silverPerOz = Array.isArray(json) ? json[0]?.silver : json?.silver;
        if (!silverPerOz || typeof silverPerOz !== "number") throw new Error("Bad data");

        const pricePerGram = silverPerOz / TROY_OZ_TO_GRAMS;
        const rounded = Math.round(pricePerGram * 10000) / 10000;

        localStorage.setItem(
          SILVER_CACHE_KEY,
          JSON.stringify({ pricePerGram: rounded, silverPerOz, fetchedAt: Date.now() })
        );

        setNisabPrice(rounded);
        setNisabDisplay(String(rounded));
        setSilverFetchStatus("fetched");
      } catch {
        setSilverFetchStatus("error");
      }
    }

    fetchSilverPrice();
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ data, nisabPrice, heldOneYear, useGregorian })
      );
    } catch {
      // ignore
    }
  }, [data, nisabPrice, heldOneYear, useGregorian]);

  const updateField = useCallback((id: string, val: number) => {
    setData((prev) => ({ ...prev, [id]: val }));
  }, []);

  const totalAssets = sumFields(data, assetsFields);
  const totalHaram = sumFields(data, haramFields);
  const totalExpenses = sumFields(data, expenseFields);
  const permissibleWealth = totalAssets - totalHaram;
  const wealthLiable = permissibleWealth - totalExpenses;
  const nisabValue = nisabPrice * 595;
  const isAboveNisab = wealthLiable > nisabValue && nisabValue > 0;
  const zakatDue = isAboveNisab && heldOneYear && silverPriceConfirmed ? wealthLiable * 0.025 : 0;
  const zakatAdjusted = useGregorian ? zakatDue * 1.02578 : zakatDue;

  const steps = ["Assets", "Purification", "Expenses", "Calculate"];

  const refetchSilver = () => {
    setSilverUserEdited(false);
    setSilverPriceConfirmed(false);
    setSilverFetchStatus("loading");
    fetch("https://api.metals.live/v1/spot")
      .then((r) => r.json())
      .then((json) => {
        const silverPerOz = Array.isArray(json) ? json[0]?.silver : json?.silver;
        if (!silverPerOz) throw new Error("Bad data");
        const pricePerGram = silverPerOz / TROY_OZ_TO_GRAMS;
        const rounded = Math.round(pricePerGram * 10000) / 10000;
        localStorage.setItem(
          SILVER_CACHE_KEY,
          JSON.stringify({ pricePerGram: rounded, silverPerOz, fetchedAt: Date.now() })
        );
        setNisabPrice(rounded);
        setNisabDisplay(String(rounded));
        setSilverFetchStatus("fetched");
      })
      .catch(() => setSilverFetchStatus("error"));
  };

  const clearAll = () => {
    if (window.confirm("Clear all calculator data? This cannot be undone.")) {
      setData({});
      setNisabPrice(0);
      setNisabDisplay("");
      setHeldOneYear(false);
      setUseGregorian(false);
      setSilverPriceConfirmed(false);
      setStep(0);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <StepIndicator steps={steps} current={step} onNavigate={setStep} />

      {/* ── Worksheet 1: Assets ── */}
      {step === 0 && (
        <div>
          <div className="mb-6 sm:mb-8">
            <h2
              className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              Worksheet 1 — Your Assets
            </h2>
            <p
              className="text-sm sm:text-base text-gray-500"
              style={{ fontFamily: FONT_UI }}
            >
              Enter the current value of each asset type you hold. Skip any that don't apply.
              {" "}
              <a
                href="/guide/assets"
                className="text-forest-500 underline underline-offset-2 hover:text-forest-700"
              >
                Learn about each asset type
              </a>
            </p>
          </div>

          {assetGroups.map((group) => (
            <FieldSection
              key={group.title}
              title={group.title}
              fields={group.fields}
              data={data}
              onChange={updateField}
            />
          ))}

          <WorksheetTotal label="Total Assets (A)" amount={totalAssets} />

          <div className="flex justify-end mt-6 sm:mt-8">
            <button
              onClick={() => setStep(1)}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-forest-800 text-white rounded-lg font-semibold transition-all hover:bg-forest-700 hover:shadow-lg text-sm sm:text-base"
              style={{ fontFamily: FONT_UI }}
            >
              Next: Haram Earnings &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ── Worksheet 2: Haram Earnings ── */}
      {step === 1 && (
        <div>
          <div className="mb-6 sm:mb-8">
            <h2
              className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              Worksheet 2 — Haram Earnings
            </h2>
            <p
              className="text-sm sm:text-base text-gray-500"
              style={{ fontFamily: FONT_UI }}
            >
              Identify impermissible income that must be subtracted and purified.
              {" "}
              <a
                href="/guide/earnings-expenses"
                className="text-forest-500 underline underline-offset-2 hover:text-forest-700"
              >
                Learn about haram earnings
              </a>
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200">
            {haramFields.map((field) => (
              <LedgerField
                key={field.id}
                field={field}
                value={data[field.id] || 0}
                onChange={updateField}
              />
            ))}
          </div>

          <WorksheetTotal label="Total Haram Earnings (B)" amount={totalHaram} />

          <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 sm:mt-8">
            <button
              onClick={() => setStep(0)}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold transition-all hover:border-gray-400 hover:bg-gray-50 text-sm sm:text-base order-2 sm:order-1"
              style={{ fontFamily: FONT_UI }}
            >
              &larr; Back
            </button>
            <button
              onClick={() => setStep(2)}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-forest-800 text-white rounded-lg font-semibold transition-all hover:bg-forest-700 hover:shadow-lg text-sm sm:text-base order-1 sm:order-2"
              style={{ fontFamily: FONT_UI }}
            >
              Next: Expenses &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ── Worksheet 3: Expenses ── */}
      {step === 2 && (
        <div>
          <div className="mb-6 sm:mb-8">
            <h2
              className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              Worksheet 3 — Expenses &amp; Liabilities
            </h2>
            <p
              className="text-sm sm:text-base text-gray-500"
              style={{ fontFamily: FONT_UI }}
            >
              Only include expenses that are <strong className="text-gray-700">immediately due</strong>.
              {" "}
              <a
                href="/guide/earnings-expenses"
                className="text-forest-500 underline underline-offset-2 hover:text-forest-700"
              >
                Learn about deductible expenses
              </a>
            </p>
          </div>

          {expenseGroups.map((group) => (
            <FieldSection
              key={group.title}
              title={group.title}
              fields={group.fields}
              data={data}
              onChange={updateField}
            />
          ))}

          <WorksheetTotal label="Total Expenses (D)" amount={totalExpenses} />

          <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 sm:mt-8">
            <button
              onClick={() => setStep(1)}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold transition-all hover:border-gray-400 hover:bg-gray-50 text-sm sm:text-base order-2 sm:order-1"
              style={{ fontFamily: FONT_UI }}
            >
              &larr; Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-gold text-white rounded-lg font-semibold transition-all hover:bg-gold-600 hover:shadow-lg text-sm sm:text-base order-1 sm:order-2"
              style={{ fontFamily: FONT_UI }}
            >
              Calculate Zakat &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ── Worksheet 4: Final Calculation ── */}
      {step === 3 && (
        <div>
          <div className="mb-6 sm:mb-8">
            <h2
              className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              Calculate Your Zakat
            </h2>
            <p
              className="text-sm sm:text-base text-gray-500"
              style={{ fontFamily: FONT_UI }}
            >
              Set your Nisab threshold, verify your Hawl, and see your final obligation.
            </p>
          </div>

          {/* ── Step 1: Nisab ── */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-6">
            <h3
              className="text-base sm:text-lg font-bold text-gray-900 mb-1 flex items-center gap-1"
              style={{ fontFamily: FONT_UI }}
            >
              Step 1: Set Your Nisab
              <InfoTooltip text="The Nisab is the minimum amount of wealth you must have before Zakat becomes required. It's based on the value of 595 grams of silver. If your total wealth is below this amount, you don't owe Zakat." />
            </h3>
            <p className="text-sm text-gray-500 mb-5" style={{ fontFamily: FONT_UI }}>
              The Nisab is calculated from the current price of silver per gram.
            </p>

            {/* Silver fetch status */}
            {silverFetchStatus === "loading" && (
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 px-4 py-3 bg-gray-50 rounded-md" style={{ fontFamily: FONT_UI }}>
                <svg className="w-4 h-4 animate-spin text-gold" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Fetching live silver price...
              </div>
            )}

            {silverFetchStatus === "fetched" && !silverUserEdited && (
              <div className="flex items-center gap-2 text-sm mb-4 px-4 py-3 bg-forest-50 rounded-md border border-forest-100" style={{ fontFamily: FONT_UI }}>
                <svg className="w-4 h-4 text-forest-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-forest-700">
                  Silver price auto-filled from live market data. You can edit it below.
                </span>
              </div>
            )}

            {silverFetchStatus === "error" && (
              <div className="flex items-center gap-2 text-sm mb-4 px-4 py-3 bg-gold-50 rounded-md border border-gold-100" style={{ fontFamily: FONT_UI }}>
                <svg className="w-4 h-4 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gold-700">
                  Could not fetch live price. Enter it manually — check{" "}
                  <a href="https://www.goldpriceoz.com/silver/silver-price-per-gram/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">goldpriceoz.com</a>
                </span>
              </div>
            )}

            {/* Silver price input */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
              <label className="text-[15px] font-medium text-gray-700 whitespace-nowrap" style={{ fontFamily: FONT_UI }}>
                Silver price per gram (USD):
              </label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" style={{ fontFamily: FONT_UI }}>$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={nisabDisplay}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, "");
                      setNisabDisplay(raw);
                      setNisabPrice(parseFloat(raw) || 0);
                      setSilverUserEdited(true);
                      setSilverPriceConfirmed(false);
                    }}
                    placeholder="0.00"
                    className="w-36 pl-7 pr-3 py-2 text-right text-base bg-white border border-gray-300 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-500"
                    style={{ fontFamily: FONT_UI }}
                  />
                </div>
                {silverFetchStatus === "fetched" && silverUserEdited && (
                  <button
                    onClick={refetchSilver}
                    className="text-sm text-forest-500 underline underline-offset-2 whitespace-nowrap hover:text-forest-700 transition-colors"
                    style={{ fontFamily: FONT_UI }}
                  >
                    Reset to live price
                  </button>
                )}
              </div>
            </div>

            {/* Nisab result */}
            <div
              className={`flex flex-wrap items-center gap-2 text-[15px] px-4 py-3 rounded-md ${
                nisabValue > 0 ? "bg-forest-50 border border-forest-100" : "bg-gray-50"
              }`}
              style={{ fontFamily: FONT_UI }}
            >
              <span className="font-semibold text-gray-700">Your Nisab:</span>
              <span className="font-bold text-gray-900 text-lg tabular-nums">${fmt(nisabValue)}</span>
              <span className="text-gray-400 text-sm">(${nisabDisplay || "0"}/g &times; 595g)</span>
            </div>

            {/* Price confirmation */}
            {nisabPrice > 0 && !silverPriceConfirmed && (
              <div
                className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-4 rounded-md border border-gold-200 bg-gold-50"
                style={{ fontFamily: FONT_UI }}
              >
                <span className="text-sm text-gold-700 flex-1">
                  Please confirm <strong>${nisabDisplay}/g</strong> is correct before calculating.
                </span>
                <button
                  onClick={() => setSilverPriceConfirmed(true)}
                  className="shrink-0 px-5 py-2 bg-forest-600 text-white text-sm font-semibold rounded-md hover:bg-forest-700 transition-colors"
                  style={{ fontFamily: FONT_UI }}
                >
                  Confirm Price
                </button>
              </div>
            )}

            {nisabPrice > 0 && silverPriceConfirmed && (
              <div
                className="mt-4 flex items-center gap-2 text-sm px-4 py-3 rounded-md bg-forest-50 border border-forest-100"
                style={{ fontFamily: FONT_UI }}
              >
                <svg className="w-4 h-4 text-forest-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-forest-700">
                  Confirmed at <strong>${nisabDisplay}/g</strong>.
                </span>
                <button
                  onClick={() => setSilverPriceConfirmed(false)}
                  className="ml-auto text-sm text-forest-500 underline underline-offset-2 hover:text-forest-700"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* ── Step 2: Hawl ── */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-6">
            <h3
              className="text-base sm:text-lg font-bold text-gray-900 mb-1 flex items-center gap-1"
              style={{ fontFamily: FONT_UI }}
            >
              Step 2: Verify Your Hawl
              <InfoTooltip text="Hawl is the Islamic fiscal year — one full lunar year (about 354 days). Your wealth must stay above the Nisab for this entire period before Zakat becomes due." />
            </h3>
            <p className="text-sm text-gray-500 mb-5" style={{ fontFamily: FONT_UI }}>
              Has your wealth remained above the Nisab for one complete lunar year (354 days)?
            </p>

            <label className="flex items-center gap-3 cursor-pointer py-2">
              <input
                type="checkbox"
                checked={heldOneYear}
                onChange={(e) => setHeldOneYear(e.target.checked)}
                className="w-5 h-5 accent-forest-600 cursor-pointer rounded"
              />
              <span className="text-[15px] font-medium text-gray-700" style={{ fontFamily: FONT_UI }}>
                Yes, my wealth has been above Nisab for a full year
              </span>
            </label>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="flex items-center gap-3 cursor-pointer py-2">
                <input
                  type="checkbox"
                  checked={useGregorian}
                  onChange={(e) => setUseGregorian(e.target.checked)}
                  className="w-5 h-5 accent-forest-600 cursor-pointer rounded"
                />
                <span className="text-[15px] text-gray-700 flex items-center gap-0.5" style={{ fontFamily: FONT_UI }}>
                  Apply Gregorian calendar adjustment
                  <InfoTooltip text="The Islamic (Hijri) year is 354 days, but the Gregorian year is 365 days — 11 extra days of wealth accumulation. If you track your Zakat date on the Gregorian calendar, this multiplier (×1.02578) compensates for those extra days." />
                </span>
              </label>
              <p className="text-sm text-gray-400 mt-1 ml-8" style={{ fontFamily: FONT_UI }}>
                Use this if you track your Zakat on the Gregorian calendar (11 extra days).
              </p>
            </div>
          </div>

          {/* ── Step 3: Calculation Summary ── */}
          <div className="bg-white rounded-lg border border-gray-200 mb-6">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <h3 className="text-base sm:text-lg font-bold text-gray-900" style={{ fontFamily: FONT_UI }}>
                Step 3: Your Zakat Breakdown
              </h3>
            </div>

            <div className="divide-y divide-gray-100">
              <SummaryRow label="A. Total Assets" amount={totalAssets} />
              <SummaryRow
                label="B. Haram Earnings"
                amount={totalHaram}
                prefix="− "
                accent="red"
                tooltip="Income from sources Islam considers impermissible — like interest (riba), or your share of a company's prohibited revenue. This amount is subtracted and should be donated to charity (not as Zakat)."
              />
              <SummaryRow
                label="C. Permissible Wealth (A − B)"
                amount={permissibleWealth}
                bold
                tooltip="Your total wealth after removing any income from prohibited sources. This is the 'clean' portion of your assets."
              />
              <SummaryRow label="D. Expenses & Liabilities" amount={totalExpenses} prefix="− " />
              <SummaryRow
                label="E. Wealth Liable for Zakat (C − D)"
                amount={wealthLiable}
                bold
                accent="green"
                tooltip="Your permissible wealth minus essential living expenses and debts. This is the final amount Zakat is calculated on — 2.5% of this number."
              />
              <SummaryRow label="F. Nisab Threshold" amount={nisabValue} />
            </div>

            {/* Status checks */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-3 sm:gap-4" style={{ fontFamily: FONT_UI }}>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shrink-0 ${isAboveNisab ? "bg-forest-500" : "bg-gray-300"}`}>
                  {isAboveNisab ? "✓" : "✗"}
                </span>
                <span className="text-gray-600">Wealth above Nisab?</span>
                <span className={`font-bold ${isAboveNisab ? "text-forest-600" : "text-gray-400"}`}>{isAboveNisab ? "Yes" : "No"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shrink-0 ${heldOneYear ? "bg-forest-500" : "bg-gray-300"}`}>
                  {heldOneYear ? "✓" : "✗"}
                </span>
                <span className="text-gray-600">Held for 1 year (Hawl)?</span>
                <span className={`font-bold ${heldOneYear ? "text-forest-600" : "text-gray-400"}`}>{heldOneYear ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>

          {/* ── Result ── */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: zakatAdjusted > 0
                ? "linear-gradient(135deg, #13291d 0%, #1e4d38 100%)"
                : "#f9fafb",
            }}
          >
            <div className="p-6 sm:p-10 text-center">
              {zakatAdjusted > 0 ? (
                <>
                  <p className="text-xs sm:text-sm font-bold tracking-wider uppercase mb-3 text-gold-300" style={{ fontFamily: FONT_UI }}>
                    Your Zakat Due
                  </p>
                  <p className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 text-white" style={{ fontFamily: FONT_DISPLAY }}>
                    ${fmt(zakatAdjusted)}
                  </p>
                  <p className="text-xs sm:text-sm text-forest-100 mb-1 break-words" style={{ fontFamily: FONT_UI }}>
                    {useGregorian
                      ? `$${fmt(wealthLiable)} × 2.5% × 1.02578 (Gregorian adj.)`
                      : `$${fmt(wealthLiable)} × 2.5%`}
                  </p>
                  <p className="text-xs mt-6 text-forest-200/70" style={{ fontFamily: FONT_UI }}>
                    May Allah accept your Zakat and bless your remaining wealth.
                  </p>
                </>
              ) : !nisabValue || !silverPriceConfirmed || !heldOneYear ? (
                <>
                  <p className="text-xs sm:text-sm font-bold tracking-wider uppercase mb-3 text-gray-400" style={{ fontFamily: FONT_UI }}>
                    Almost There
                  </p>
                  <p className="text-xl sm:text-2xl font-bold mb-3 text-gray-700" style={{ fontFamily: FONT_DISPLAY }}>
                    Complete the steps above to calculate
                  </p>
                  <p className="text-sm text-gray-500 max-w-md mx-auto" style={{ fontFamily: FONT_UI }}>
                    {!nisabValue
                      ? "Enter the silver price above to calculate your Nisab."
                      : !silverPriceConfirmed
                        ? "Confirm the silver price above to proceed."
                        : "Confirm that your wealth has been above Nisab for a full year."}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs sm:text-sm font-bold tracking-wider uppercase mb-3 text-gray-400" style={{ fontFamily: FONT_UI }}>
                    Zakat Status
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold mb-3 text-gray-800" style={{ fontFamily: FONT_DISPLAY }}>
                    No Zakat Due
                  </p>
                  <p className="text-sm text-gray-500 max-w-md mx-auto" style={{ fontFamily: FONT_UI }}>
                    Your liable wealth is below the Nisab threshold.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mt-6 sm:mt-8">
            <button
              onClick={() => setStep(2)}
              className="px-6 sm:px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold transition-all hover:border-gray-400 hover:bg-gray-50 text-sm sm:text-base order-2 sm:order-1"
              style={{ fontFamily: FONT_UI }}
            >
              &larr; Back to Expenses
            </button>
            <div className="flex gap-3 order-1 sm:order-2">
              <button
                onClick={() => window.print()}
                className="px-4 sm:px-6 py-3 border-2 border-gray-300 text-gray-600 rounded-lg font-semibold transition-all hover:border-gray-400 hover:text-gray-800 flex-1 sm:flex-initial text-sm sm:text-base"
                style={{ fontFamily: FONT_UI }}
              >
                Print
              </button>
              <button
                onClick={clearAll}
                className="px-4 sm:px-6 py-3 border-2 border-red-200 text-red-500 rounded-lg font-semibold transition-all hover:bg-red-50 hover:border-red-300 flex-1 sm:flex-initial text-sm sm:text-base"
                style={{ fontFamily: FONT_UI }}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Privacy & Disclaimer ── */}
      <div className="mt-10 sm:mt-14 rounded-lg border border-gray-200 overflow-hidden" style={{ fontFamily: FONT_UI }}>
        <div className="bg-forest-50 px-4 sm:px-6 py-4 sm:py-5 flex items-start gap-3 sm:gap-4 border-b border-forest-100">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-forest-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-forest-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-forest-800 mb-1">100% Private — Your data never leaves your device</p>
            <p className="text-xs sm:text-sm text-forest-700 leading-relaxed">
              All calculations run entirely in your browser. <strong>Nothing is ever sent to any server.</strong>{" "}
              Your entries are saved only in your browser's local cache. This cache
              lives on your device alone and can be cleared at any time with the "Clear All" button.
            </p>
          </div>
        </div>
        <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4">
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
            <strong className="text-gray-600">Disclaimer:</strong> This calculator is an educational tool
            based on <em>Simple Zakat Guide</em> by Joe Bradford. It does not
            constitute religious or financial advice. Please consult a qualified
            Islamic scholar for rulings specific to your situation.
          </p>
        </div>
      </div>
    </div>
  );
}
