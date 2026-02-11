import { useState, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FieldDef {
  id: string;
  label: string;
  hint?: string;
  tooltip?: string;
}

interface WorksheetData {
  [key: string]: number;
}

const STORAGE_KEY = "zakat-calculator-data";
const TROY_OZ_TO_GRAMS = 31.1035;
const SILVER_CACHE_KEY = "zakat-silver-price";
const SILVER_CACHE_MAX_AGE = 1000 * 60 * 60; // 1 hour

// ─── Field Definitions ───────────────────────────────────────────────────────

const assetsFields: FieldDef[] = [
  { id: "cash_on_hand", label: "Cash on hand", hint: "Physical currency" },
  { id: "checking", label: "Checking accounts", hint: "All checking account balances" },
  { id: "savings", label: "Savings accounts", hint: "All savings account balances" },
  {
    id: "gold", label: "Gold (value in currency)", hint: "All gold jewelry, bullion, coins — by pure weight",
    tooltip: "Add up all your gold — jewelry, coins, bars. Only count the pure gold content, not the total weight of mixed items. Look up today's gold price per gram and multiply by your total pure gold weight.",
  },
  { id: "silver", label: "Silver (value in currency)", hint: "All silver jewelry, bullion, coins, silverware" },
  {
    id: "active_investments", label: "Active investments", hint: "Stocks traded < 1 year — full market value",
    tooltip: "Investments you actively trade — stocks, ETFs, or funds bought and sold within the past year. Enter their full market value today.",
  },
  {
    id: "passive_investments", label: "Passive investments (CRI)", hint: "Long-term stocks — use CRI method (≈30% of market value)",
    tooltip: "Long-term investments (held over 1 year) that you don't actively trade. With the CRI method, you only count about 30% of the market value. Example: If your index fund is worth $10,000, enter $3,000.",
  },
  {
    id: "dividends", label: "Dividend earnings", hint: "Total dividend income received",
    tooltip: "Cash payments companies pay you for owning their stock. Check your brokerage account for total dividends received this year.",
  },
  {
    id: "capital_gains", label: "Capital gains on sales", hint: "Gains from assets sold this year",
    tooltip: "Profit from selling an asset for more than you paid. Example: Bought shares for $1,000, sold for $1,500 — your capital gain is $500.",
  },
  {
    id: "retirement_401k", label: "401(k) / pension", hint: "Net value if using Approach 1; or 0 if deferring (Approach 2)",
    tooltip: "Two approaches: (1) Include the full balance minus early-withdrawal penalties and taxes. (2) Enter $0 now and pay Zakat when you actually withdraw the money in retirement.",
  },
  {
    id: "retirement_ira", label: "IRA / Roth IRA", hint: "Net value if using Approach 1; or 0 if deferring",
    tooltip: "Same two approaches as 401(k). Choose Approach 1 to pay Zakat now on the full value, or Approach 2 to defer Zakat until you withdraw.",
  },
  {
    id: "education_accounts", label: "Education accounts (529, ESA)", hint: "Only if not used for education expenses",
    tooltip: "529 plans, Coverdell ESAs, and similar accounts. Only include if the funds won't be used for education. If your child is currently using it for school, enter $0.",
  },
  {
    id: "hsa", label: "Health Savings Account (HSA)", hint: "Full aggregate balance — rolls over yearly",
    tooltip: "Unlike FSAs, HSA balances roll over every year and the money is permanently yours. Include the full balance.",
  },
  {
    id: "real_estate_market", label: "Real estate (on market)", hint: "Current market value of properties actively for sale",
    tooltip: "Only properties you are actively trying to sell right now. Your personal home, vacation home, and rental properties you plan to keep are not included here.",
  },
  {
    id: "rental_income", label: "Rental income", hint: "Net rental income from investment properties",
    tooltip: "Your net rental profit: total rent collected minus property expenses like repairs, management fees, and maintenance costs.",
  },
  { id: "cryptocurrency", label: "Cryptocurrency", hint: "Total value in local currency" },
  {
    id: "nfts_digital", label: "NFTs & digital assets", hint: "Based on underlying asset rules",
    tooltip: "Digital assets like NFTs. If held for trade or sale, use their current market value. Personal-use digital items may be exempt.",
  },
  {
    id: "business_inventory", label: "Business inventory", hint: "Unsold inventory not under contract",
    tooltip: "Products in stock that haven't been sold or committed under contract. Don't include equipment, tools, or raw materials you use to run the business.",
  },
  {
    id: "accounts_receivable", label: "Accounts receivable", hint: "Money owed to you (collectible)",
    tooltip: "Money that customers or clients owe you that you can reasonably expect to collect. Don't include debts you've written off as uncollectable.",
  },
  {
    id: "good_debt", label: "Good debt owed to you", hint: "Loans to others you can reasonably collect",
    tooltip: "Money you've lent to someone who is able and expected to pay it back. Don't include money you don't realistically expect to recover.",
  },
  { id: "other_assets", label: "Other liable assets", hint: "Collectibles for sale, livestock for sale, etc." },
];

const haramFields: FieldDef[] = [
  {
    id: "equity_haram", label: "Equity haram earnings", hint: "(Prohibited income / Shares outstanding) × Your shares",
    tooltip: "Your share of a company's prohibited income (like interest or alcohol revenue). Formula: (Company's prohibited income ÷ Total shares outstanding) × Your shares. \"Shares outstanding\" means the total number of shares a company has issued — you can find this on Yahoo Finance or Google Finance under the stock's key statistics.",
  },
  {
    id: "dividend_haram", label: "Dividend haram earnings", hint: "(Prohibited income / Total income) × Dividend received",
    tooltip: "The prohibited portion of dividends you received. Formula: (Company's prohibited income ÷ Company's total revenue) × Your dividend. Example: If 5% of a company's revenue is from prohibited sources and you received $200 in dividends, enter $10.",
  },
  {
    id: "bond_interest", label: "Bond / interest earnings", hint: "Interest earned from fixed-income instruments",
    tooltip: "All interest earned from bonds, CDs, money market funds, or savings accounts. Interest income (riba) is considered impermissible and must be removed from your wealth.",
  },
];

const expenseFields: FieldDef[] = [
  { id: "rent_mortgage", label: "Rent / mortgage (1 month)", hint: "One month's housing payment" },
  { id: "medical", label: "Medical expenses", hint: "Current period medical costs" },
  { id: "groceries", label: "Groceries & household", hint: "One month's food and supplies" },
  { id: "utilities", label: "Utilities & telecom", hint: "One month's utilities" },
  { id: "transport", label: "Transportation & fuel", hint: "One month's transport costs" },
  { id: "insurance", label: "Insurance payments", hint: "Home, auto, medical — period-due amount" },
  {
    id: "property_tax", label: "Property taxes (period-due)", hint: "Only the currently-due portion",
    tooltip: "Only enter the portion that's currently due — not your full annual tax bill. Example: If your annual property tax is $6,000 paid quarterly, enter $1,500.",
  },
  {
    id: "delinquent_tax", label: "Delinquent taxes & fines", hint: "Overdue taxes, fines, penalties",
    tooltip: "Overdue taxes, unpaid parking or traffic tickets, court fines, or government penalties you currently owe.",
  },
  {
    id: "debts_owed", label: "Debts owed (immediately due)", hint: "Only debts with current payment obligations",
    tooltip: "Only debts with payments due right now — this month's credit card minimum, a loan installment due today, etc. Don't enter your total mortgage balance or total student loan amount.",
  },
  { id: "other_expenses", label: "Other deductible expenses", hint: "Miscellaneous living costs" },
];

// ─── Utility ─────────────────────────────────────────────────────────────────

function sumFields(data: WorksheetData, fields: FieldDef[]): number {
  return fields.reduce((sum, f) => sum + (data[f.id] || 0), 0);
}

function formatCurrency(n: number): string {
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
      className="relative inline-flex items-center ml-1.5"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="w-[18px] h-[18px] rounded-full bg-[#d4c5a9]/70 text-[#5c4a12] text-[10px] font-bold inline-flex items-center justify-center hover:bg-[#b8860b] hover:text-white transition-colors cursor-help"
        aria-label="More info"
      >
        ?
      </button>
      {show && (
        <span
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-[#13291d] text-[#faf7f0] text-xs rounded-sm shadow-lg z-50 leading-relaxed"
          style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#13291d]" />
          <span className="absolute left-0 right-0 -bottom-4 h-4" />
        </span>
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
    <div className="flex items-center justify-between mb-10 overflow-x-auto pb-2">
      {steps.map((label, i) => (
        <button
          key={label}
          onClick={() => onNavigate(i)}
          className={`flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-all whitespace-nowrap
            ${i === current
              ? "bg-[#13291d] text-[#faf7f0]"
              : i < current
                ? "bg-[#e9f5ee] text-[#2d6a4f] cursor-pointer hover:bg-[#c8e6d0]"
                : "bg-[#f0ebe0] text-[#6b6b6b]"
            }`}
          style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${i === current
                ? "bg-[#d4a843] text-white"
                : i < current
                  ? "bg-[#2d6a4f] text-white"
                  : "bg-[#d4c5a9] text-white"
              }`}
          >
            {i < current ? "✓" : i + 1}
          </span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 px-4 border-b border-[#e4dac8]/60 hover:bg-[#f0ebe0]/50 transition-colors group">
      <div className="flex-1 min-w-0 mb-2 sm:mb-0">
        <label
          htmlFor={field.id}
          className="inline-flex items-center text-sm font-medium text-[#1e1e1e] cursor-pointer"
          style={{ fontFamily: '"Crimson Pro", Georgia, serif' }}
        >
          {field.label}
          {field.tooltip && <InfoTooltip text={field.tooltip} />}
        </label>
        {field.hint && (
          <p
            className="text-xs text-[#6b6b6b] mt-0.5"
            style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
          >
            {field.hint}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[#6b6b6b] text-sm" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>$</span>
        <input
          id={field.id}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, "");
            setDisplayValue(raw);
            const num = parseFloat(raw) || 0;
            onChange(field.id, num);
          }}
          onBlur={() => {
            const num = parseFloat(displayValue) || 0;
            setDisplayValue(num ? String(num) : "");
          }}
          placeholder="0.00"
          className="text-right bg-transparent border-b-2 border-[#d4c5a9] focus:border-[#b8860b] focus:outline-none px-2 py-1 w-36 text-lg transition-colors"
          style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
        />
      </div>
    </div>
  );
}

function WorksheetTotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div
      className="flex items-center justify-between py-4 px-4 bg-[#13291d] text-[#faf7f0] rounded-sm mt-3"
      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
    >
      <span className="text-lg font-semibold">{label}</span>
      <span className="text-xl font-bold">${formatCurrency(amount)}</span>
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
      // Don't overwrite if user already has a saved value
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nisabPrice) return;
      }

      // Check if we have a recent cached fetch
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
        // metals.live returns an array with one object containing "silver" in USD/troy oz
        const silverPerOz = Array.isArray(json) ? json[0]?.silver : json?.silver;
        if (!silverPerOz || typeof silverPerOz !== "number") throw new Error("Bad data");

        const pricePerGram = silverPerOz / TROY_OZ_TO_GRAMS;
        const rounded = Math.round(pricePerGram * 10000) / 10000;

        // Cache the result
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

  const steps = ["Assets", "Haram Earnings", "Expenses", "Calculate"];

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

  return (
    <div>
      <StepIndicator steps={steps} current={step} onNavigate={setStep} />

      {/* ── Worksheet 1: Assets ── */}
      {step === 0 && (
        <div>
          <div className="mb-6">
            <h2
              className="text-2xl font-semibold text-[#1e1e1e] mb-2"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Worksheet 1: Total Earnings &amp; Income
            </h2>
            <p
              className="text-sm text-[#3d3d3d]"
              style={{ fontFamily: '"Crimson Pro", Georgia, serif' }}
            >
              Enter the value of each asset type you hold. Leave fields at 0 if
              they don't apply.
              {" "}
              <a
                href="/guide/assets"
                className="text-[#2d6a4f] underline decoration-[#b8860b]/40 underline-offset-2 hover:text-[#1a3d2b]"
              >
                Learn about each asset type
              </a>
            </p>
          </div>

          <div className="bg-[#fefcf8] border border-[#d4c5a9]/40 rounded-sm overflow-hidden">
            {assetsFields.map((field) => (
              <LedgerField
                key={field.id}
                field={field}
                value={data[field.id] || 0}
                onChange={updateField}
              />
            ))}
            <WorksheetTotal label="Total Assets (A)" amount={totalAssets} />
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setStep(1)}
              className="px-8 py-3 bg-[#13291d] text-[#faf7f0] rounded-sm font-semibold transition-all hover:bg-[#1a3d2b] hover:shadow-lg"
              style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
            >
              Next: Haram Earnings →
            </button>
          </div>
        </div>
      )}

      {/* ── Worksheet 2: Haram Earnings ── */}
      {step === 1 && (
        <div>
          <div className="mb-6">
            <h2
              className="text-2xl font-semibold text-[#1e1e1e] mb-2"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Worksheet 2: Haram Earnings
            </h2>
            <p
              className="text-sm text-[#3d3d3d]"
              style={{ fontFamily: '"Crimson Pro", Georgia, serif' }}
            >
              Identify impermissible income that must be subtracted and purified.
              {" "}
              <a
                href="/guide/earnings-expenses"
                className="text-[#2d6a4f] underline decoration-[#b8860b]/40 underline-offset-2 hover:text-[#1a3d2b]"
              >
                Learn about haram earnings
              </a>
            </p>
          </div>

          <div className="bg-[#fefcf8] border border-[#d4c5a9]/40 rounded-sm overflow-hidden">
            {haramFields.map((field) => (
              <LedgerField
                key={field.id}
                field={field}
                value={data[field.id] || 0}
                onChange={updateField}
              />
            ))}
            <WorksheetTotal label="Total Haram Earnings (B)" amount={totalHaram} />
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(0)}
              className="px-8 py-3 border-2 border-[#13291d] text-[#13291d] rounded-sm font-semibold transition-all hover:bg-[#13291d] hover:text-[#faf7f0]"
              style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(2)}
              className="px-8 py-3 bg-[#13291d] text-[#faf7f0] rounded-sm font-semibold transition-all hover:bg-[#1a3d2b] hover:shadow-lg"
              style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
            >
              Next: Expenses →
            </button>
          </div>
        </div>
      )}

      {/* ── Worksheet 3: Expenses ── */}
      {step === 2 && (
        <div>
          <div className="mb-6">
            <h2
              className="text-2xl font-semibold text-[#1e1e1e] mb-2"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Worksheet 3: Expenses &amp; Liabilities
            </h2>
            <p
              className="text-sm text-[#3d3d3d]"
              style={{ fontFamily: '"Crimson Pro", Georgia, serif' }}
            >
              Only include expenses that are <strong>immediately due</strong>.
              {" "}
              <a
                href="/guide/earnings-expenses"
                className="text-[#2d6a4f] underline decoration-[#b8860b]/40 underline-offset-2 hover:text-[#1a3d2b]"
              >
                Learn about deductible expenses
              </a>
            </p>
          </div>

          <div className="bg-[#fefcf8] border border-[#d4c5a9]/40 rounded-sm overflow-hidden">
            {expenseFields.map((field) => (
              <LedgerField
                key={field.id}
                field={field}
                value={data[field.id] || 0}
                onChange={updateField}
              />
            ))}
            <WorksheetTotal label="Total Expenses (D)" amount={totalExpenses} />
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(1)}
              className="px-8 py-3 border-2 border-[#13291d] text-[#13291d] rounded-sm font-semibold transition-all hover:bg-[#13291d] hover:text-[#faf7f0]"
              style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-8 py-3 bg-[#b8860b] text-white rounded-sm font-semibold transition-all hover:bg-[#9a7009] hover:shadow-lg"
              style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
            >
              Calculate Zakat →
            </button>
          </div>
        </div>
      )}

      {/* ── Worksheet 4: Final Calculation ── */}
      {step === 3 && (
        <div>
          <div className="mb-6">
            <h2
              className="text-2xl font-semibold text-[#1e1e1e] mb-2"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Worksheet 4: Calculate Your Zakat
            </h2>
            <p
              className="text-sm text-[#3d3d3d]"
              style={{ fontFamily: '"Crimson Pro", Georgia, serif' }}
            >
              Determine your Nisab, verify your Hawl, and compute your final obligation.
            </p>
          </div>

          {/* Nisab Calculation */}
          <div className="bg-[#fefcf8] border border-[#d4c5a9]/40 rounded-sm p-6 mb-6">
            <h3
              className="text-lg font-semibold mb-4 text-[#1e1e1e]"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Step 1: Find Your Nisab
              <InfoTooltip text="The Nisab is the minimum amount of wealth you must have before Zakat becomes required. It's based on the value of 595 grams of silver. If your total wealth is below this amount, you don't owe Zakat." />
            </h3>

            {/* Auto-fetch status */}
            {silverFetchStatus === "loading" && (
              <div
                className="flex items-center gap-2 text-sm text-[#3d3d3d] mb-4 px-4 py-3 bg-[#f0ebe0] rounded-sm"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                <svg className="w-4 h-4 animate-spin text-[#b8860b]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Fetching current silver price...
              </div>
            )}

            {silverFetchStatus === "fetched" && !silverUserEdited && (
              <div
                className="flex items-center gap-2 text-sm mb-4 px-4 py-3 bg-[#e9f5ee] rounded-sm border border-[#c8e6d0]"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                <svg className="w-4 h-4 text-[#2d6a4f] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-[#1e4d38]">
                  Silver price auto-filled from live market data (USD per gram).
                  You can edit it below if needed.
                </span>
              </div>
            )}

            {silverFetchStatus === "error" && (
              <div
                className="flex items-center gap-2 text-sm mb-4 px-4 py-3 bg-[#fdf8ed] rounded-sm border border-[#ebd09e]"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                <svg className="w-4 h-4 text-[#b8860b] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[#7c5a07]">
                  Could not fetch the live silver price. Enter it manually — check{" "}
                  <a
                    href="https://www.silverpriceoz.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    silverpriceoz.com
                  </a>{" "}
                  for the current price per gram.
                </span>
              </div>
            )}

            {silverFetchStatus === "idle" && (
              <p
                className="text-sm text-[#3d3d3d] mb-4"
                style={{ fontFamily: '"Crimson Pro", Georgia, serif' }}
              >
                Enter the current price of silver per gram. Check{" "}
                <a
                  href="https://www.silverpriceoz.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2d6a4f] underline decoration-[#b8860b]/40 underline-offset-2"
                >
                  silverpriceoz.com
                </a>{" "}
                for the latest price.
              </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
              <label
                className="text-sm font-medium whitespace-nowrap"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                Silver price per gram (USD):
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[#6b6b6b]">$</span>
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
                  className="text-right bg-transparent border-b-2 border-[#d4c5a9] focus:border-[#b8860b] focus:outline-none px-2 py-1 w-32 text-lg"
                  style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
                />
                {silverFetchStatus === "fetched" && silverUserEdited && (
                  <button
                    onClick={() => {
                      // Refetch
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
                    }}
                    className="text-xs text-[#2d6a4f] underline underline-offset-2 whitespace-nowrap hover:text-[#13291d] transition-colors"
                    style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
                  >
                    Reset to live price
                  </button>
                )}
              </div>
            </div>

            <div
              className="flex flex-wrap items-center gap-2 text-sm px-4 py-3 rounded-sm"
              style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                background: nisabValue > 0 ? "#e9f5ee" : "#f0ebe0",
              }}
            >
              <span className="font-medium">Nisab (F):</span>
              <span className="font-bold">
                ${formatCurrency(nisabValue)}
              </span>
              <span className="text-[#6b6b6b]">(${nisabDisplay || "0"}/g × 595g)</span>
            </div>

            {/* Price confirmation */}
            {nisabPrice > 0 && !silverPriceConfirmed && (
              <div
                className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-4 rounded-sm border border-[#b8860b]/30 bg-[#fdf8ed]"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                <div className="flex items-center gap-2 text-sm text-[#5c4a12]">
                  <svg className="w-5 h-5 text-[#b8860b] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Please confirm <strong>${nisabDisplay}/g</strong> is the correct silver price before calculating.
                  </span>
                </div>
                <button
                  onClick={() => setSilverPriceConfirmed(true)}
                  className="shrink-0 px-5 py-2 bg-[#2d6a4f] text-white text-sm font-semibold rounded-sm hover:bg-[#1e4d38] transition-colors"
                  style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
                >
                  Confirm Price
                </button>
              </div>
            )}

            {nisabPrice > 0 && silverPriceConfirmed && (
              <div
                className="mt-4 flex items-center gap-2 text-sm px-4 py-3 rounded-sm bg-[#e9f5ee] border border-[#c8e6d0]"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                <svg className="w-4 h-4 text-[#2d6a4f] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-[#1e4d38]">
                  Silver price confirmed at <strong>${nisabDisplay}/g</strong>.
                </span>
                <button
                  onClick={() => setSilverPriceConfirmed(false)}
                  className="ml-auto text-xs text-[#2d6a4f] underline underline-offset-2 hover:text-[#13291d] transition-colors"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Hawl Check */}
          <div className="bg-[#fefcf8] border border-[#d4c5a9]/40 rounded-sm p-6 mb-6">
            <h3
              className="text-lg font-semibold mb-4 text-[#1e1e1e]"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Step 2: Verify Your Hawl
              <InfoTooltip text="Hawl is the Islamic fiscal year — one full lunar year (about 354 days). Your wealth must stay above the Nisab for this entire period before Zakat becomes due." />
            </h3>
            <p
              className="text-sm text-[#3d3d3d] mb-4"
              style={{ fontFamily: '"Crimson Pro", Georgia, serif' }}
            >
              Has your wealth remained above the Nisab for one complete lunar year (354 days)?
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={heldOneYear}
                onChange={(e) => setHeldOneYear(e.target.checked)}
                className="w-5 h-5 accent-[#2d6a4f] cursor-pointer"
              />
              <span
                className="text-sm font-medium"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                Yes, my wealth has been above Nisab for a full year
              </span>
            </label>

            <div className="mt-4 pt-4 border-t border-[#e4dac8]/60">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useGregorian}
                  onChange={(e) => setUseGregorian(e.target.checked)}
                  className="w-5 h-5 accent-[#2d6a4f] cursor-pointer"
                />
                <span
                  className="text-sm"
                  style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
                >
                  Apply Gregorian calendar adjustment
                  <InfoTooltip text="The Islamic (Hijri) year is 354 days, but the Gregorian year is 365 days — 11 extra days of wealth accumulation. If you track your Zakat date on the Gregorian calendar, this multiplier (×1.02578) compensates for those extra days." />
                </span>
              </label>
              <p
                className="text-xs text-[#6b6b6b] mt-1 ml-8"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                Use this if you track your Zakat on the Gregorian calendar (11 extra days).
              </p>
            </div>
          </div>

          {/* Final Calculation */}
          <div className="bg-[#fefcf8] border border-[#d4c5a9]/40 rounded-sm p-6 mb-6">
            <h3
              className="text-lg font-semibold mb-6 text-[#1e1e1e]"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Step 3: Your Zakat Calculation
            </h3>

            <div className="space-y-3">
              <div
                className="flex justify-between items-center py-2 border-b border-[#e4dac8]/40"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                <span className="text-sm">A. Total Assets</span>
                <span className="font-semibold">${formatCurrency(totalAssets)}</span>
              </div>

              <div
                className="flex justify-between items-center py-2 border-b border-[#e4dac8]/40"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                <span className="text-sm text-red-700 inline-flex items-center">B. Total Haram Earnings<InfoTooltip text="Income from sources Islam considers impermissible — like interest (riba), or your share of a company's prohibited revenue. This amount is subtracted from your wealth and should be donated to charity (not as Zakat)." /></span>
                <span className="font-semibold text-red-700">− ${formatCurrency(totalHaram)}</span>
              </div>

              <div
                className="flex justify-between items-center py-2 border-b border-[#d4c5a9]/60"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                <span className="text-sm font-medium inline-flex items-center">C. Permissible Wealth (A − B)<InfoTooltip text="Your total wealth after removing any income from prohibited sources. This is the 'clean' portion of your assets that can be considered for Zakat." /></span>
                <span className="font-bold">${formatCurrency(permissibleWealth)}</span>
              </div>

              <div
                className="flex justify-between items-center py-2 border-b border-[#e4dac8]/40"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                <span className="text-sm">D. Total Expenses &amp; Liabilities</span>
                <span className="font-semibold">− ${formatCurrency(totalExpenses)}</span>
              </div>

              <div
                className="flex justify-between items-center py-3 border-b-2 border-[#b8860b]/30"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                <span className="text-sm font-bold inline-flex items-center">E. Wealth Liable for Zakat (C − D)<InfoTooltip text="Your permissible wealth minus essential living expenses and debts. This is the final amount that Zakat is calculated on — 2.5% of this number." /></span>
                <span className="font-bold text-lg">${formatCurrency(wealthLiable)}</span>
              </div>

              <div
                className="flex justify-between items-center py-2"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                <span className="text-sm">F. Nisab (minimum threshold)</span>
                <span className="font-semibold">${formatCurrency(nisabValue)}</span>
              </div>

              {/* Status checks */}
              <div
                className="flex items-center gap-2 py-2 text-sm"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs text-white ${
                    isAboveNisab ? "bg-[#2d6a4f]" : "bg-[#6b6b6b]"
                  }`}
                >
                  {isAboveNisab ? "✓" : "✗"}
                </span>
                <span>Wealth above Nisab?</span>
                <span className="font-semibold">{isAboveNisab ? "Yes" : "No"}</span>
              </div>

              <div
                className="flex items-center gap-2 py-2 text-sm"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs text-white ${
                    heldOneYear ? "bg-[#2d6a4f]" : "bg-[#6b6b6b]"
                  }`}
                >
                  {heldOneYear ? "✓" : "✗"}
                </span>
                <span>Held above Nisab for 1 year?</span>
                <span className="font-semibold">{heldOneYear ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>

          {/* RESULT */}
          <div
            className="rounded-sm overflow-hidden"
            style={{
              background: zakatAdjusted > 0
                ? "linear-gradient(135deg, #13291d 0%, #1e4d38 100%)"
                : "#f0ebe0",
            }}
          >
            <div className="p-8 text-center">
              {zakatAdjusted > 0 ? (
                <>
                  <p
                    className="text-sm font-semibold tracking-wider uppercase mb-2"
                    style={{
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      color: "#d4a843",
                    }}
                  >
                    Your Zakat Due
                  </p>
                  <p
                    className="text-5xl md:text-6xl font-bold mb-3"
                    style={{
                      fontFamily: '"Cormorant Garamond", Georgia, serif',
                      color: "#faf7f0",
                    }}
                  >
                    ${formatCurrency(zakatAdjusted)}
                  </p>
                  <p
                    className="text-sm mb-1"
                    style={{
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      color: "#c8e6d0",
                    }}
                  >
                    {useGregorian
                      ? `$${formatCurrency(wealthLiable)} × 2.5% × 1.02578 (Gregorian adjustment)`
                      : `$${formatCurrency(wealthLiable)} × 2.5%`}
                  </p>
                  <p
                    className="text-xs mt-4 opacity-70"
                    style={{
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      color: "#c8e6d0",
                    }}
                  >
                    May Allah accept your Zakat and bless your remaining wealth.
                  </p>
                </>
              ) : (
                <>
                  <p
                    className="text-sm font-semibold tracking-wider uppercase mb-2 text-[#3d3d3d]"
                    style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
                  >
                    Zakat Status
                  </p>
                  <p
                    className="text-3xl font-bold mb-3 text-[#1e1e1e]"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                  >
                    No Zakat Due
                  </p>
                  <p
                    className="text-sm text-[#3d3d3d]"
                    style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
                  >
                    {!nisabValue
                      ? "Enter the silver price above to calculate your Nisab."
                      : !silverPriceConfirmed
                        ? "Please confirm the silver price above to proceed."
                        : !isAboveNisab
                          ? "Your liable wealth is below the Nisab threshold."
                          : "Confirm that your wealth has been above Nisab for a full year."}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8">
            <button
              onClick={() => setStep(2)}
              className="px-8 py-3 border-2 border-[#13291d] text-[#13291d] rounded-sm font-semibold transition-all hover:bg-[#13291d] hover:text-[#faf7f0] w-full sm:w-auto"
              style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
            >
              ← Back to Expenses
            </button>
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={() => window.print()}
                className="px-6 py-3 border-2 border-[#d4c5a9] text-[#3d3d3d] rounded-sm font-semibold transition-all hover:border-[#b8860b] hover:text-[#b8860b] flex-1 sm:flex-initial"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                Print
              </button>
              <button
                onClick={clearAll}
                className="px-6 py-3 border-2 border-red-300 text-red-600 rounded-sm font-semibold transition-all hover:bg-red-50 flex-1 sm:flex-initial"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy & Disclaimer */}
      <div
        className="mt-12 rounded-sm border border-[#d4c5a9]/40 overflow-hidden"
        style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
      >
        <div className="bg-[#e9f5ee] px-5 py-4 flex items-start gap-3 border-b border-[#c8e6d0]">
          <svg className="w-5 h-5 text-[#2d6a4f] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <p className="text-sm font-bold text-[#13291d] mb-1">100% Private — No one can see your data</p>
            <p className="text-sm text-[#1e4d38] leading-relaxed">
              All calculations run entirely in your browser. <strong>Nothing is
              ever sent to any server.</strong> The website owner has no access
              to the numbers you enter — there is no database, no analytics on
              your inputs, and no tracking of your financial information. Your
              entries are saved only to your browser's local cache so you don't
              lose your progress if you accidentally close the page. This cache
              lives on your device alone and can be cleared at any time with the
              "Clear All" button above.
            </p>
          </div>
        </div>
        <div className="bg-[#f0ebe0] px-5 py-4">
          <p className="text-sm text-[#3d3d3d] leading-relaxed">
            <strong>Disclaimer:</strong> This calculator is an educational tool
            based on <em>Simple Zakat Guide</em> by Joe Bradford. It does not
            constitute religious or financial advice. Please consult a qualified
            Islamic scholar for rulings specific to your situation.
          </p>
        </div>
      </div>
    </div>
  );
}
