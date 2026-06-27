export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'jcb' | 'diners' | 'unknown';

const brandLabels: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  discover: 'Discover',
  jcb: 'JCB',
  diners: 'Diners Club',
  unknown: 'Card',
};

const digitsOnly = (value: string) => value.replace(/\D/g, '');

export const detectCardBrand = (value: string): CardBrand => {
  const digits = digitsOnly(value);
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) {
    const firstFour = Number(digits.slice(0, 4));
    if (/^5[1-5]/.test(digits) || (firstFour >= 2221 && firstFour <= 2720)) return 'mastercard';
  }
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^(6011|65|64[4-9]|622)/.test(digits)) return 'discover';
  if (/^35/.test(digits)) {
    const firstFour = Number(digits.slice(0, 4));
    if (firstFour >= 3528 && firstFour <= 3589) return 'jcb';
  }
  if (/^(30[0-5]|36|38|39)/.test(digits)) return 'diners';
  return 'unknown';
};

export const formatCardNumber = (value: string, brand = detectCardBrand(value)) => {
  const maxDigits = brand === 'amex' ? 15 : 16;
  const digits = digitsOnly(value).slice(0, maxDigits);

  if (brand === 'amex') {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(' ');
  }

  return digits.replace(/(.{4})/g, '$1 ').trim();
};

export const isValidLuhn = (value: string) => {
  const digits = digitsOnly(value);
  if (digits.length < 12) return false;

  let total = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    total += digit;
    shouldDouble = !shouldDouble;
  }

  return total % 10 === 0;
};

export const validateCardNumber = (value: string, brand = detectCardBrand(value)) => {
  const digits = digitsOnly(value);
  if (!digits) return 'Card number is required.';
  if (brand === 'unknown') return 'Enter a supported card number.';
  if (brand === 'amex' && digits.length !== 15) return 'American Express card numbers must be 15 digits.';
  if (brand !== 'amex' && digits.length !== 16) return `${brandLabels[brand]} card numbers must be 16 digits.`;
  if (!isValidLuhn(digits)) return 'Card number is not valid.';
  return '';
};

export const formatExpiry = (value: string) => {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

export const validateExpiry = (value: string) => {
  if (!value) return 'Expiry date is required.';
  if (!/^\d{2}\/\d{2}$/.test(value)) return 'Use MM/YY format.';

  const [monthText, yearText] = value.split('/');
  const month = Number(monthText);
  if (month < 1 || month > 12) return 'Enter a valid month.';

  const expiryYear = 2000 + Number(yearText);
  const expiryDate = new Date(expiryYear, month, 0, 23, 59, 59, 999);
  if (expiryDate < new Date()) return 'Card has expired.';

  return '';
};

export const validateSecurityCode = (value: string, brand: CardBrand) => {
  const digits = digitsOnly(value);
  const requiredLength = brand === 'amex' ? 4 : 3;
  if (!digits) return `${brand === 'amex' ? 'CID' : 'CVV'} is required.`;
  if (digits.length !== requiredLength) {
    return `${brand === 'amex' ? 'CID' : 'CVV'} must be ${requiredLength} digits.`;
  }
  return '';
};

export const getCardBrandLabel = (brand: CardBrand) => brandLabels[brand];

export const validatePostcode = (value: string) => {
  if (!value.trim()) return 'ZIP/Postcode is required.';
  return '';
};

export function AcceptedPaymentBadges() {
  const methods: Array<CardBrand | 'apple-pay' | 'contactless'> = [
    'visa',
    'mastercard',
    'amex',
    'discover',
    'apple-pay',
    'contactless',
  ];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accepted payment methods</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {methods.map((method) => (
          <PaymentMark key={method} brand={method} size="md" />
        ))}
      </div>
    </div>
  );
}

export function CardTypeBadge({ brand }: { brand: CardBrand }) {
  return <PaymentMark brand={brand} size="sm" />;
}

function PaymentMark({
  brand,
  size = 'md',
}: {
  brand: CardBrand | 'apple-pay' | 'contactless';
  size?: 'sm' | 'md';
}) {
  const compact = size === 'sm';
  const baseClass = compact
    ? 'h-7 min-w-14 rounded-md px-2 text-[10px]'
    : 'h-8 min-w-[76px] rounded-md px-3 text-[11px]';

  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden border font-bold tracking-wide shadow-sm ${baseClass} ${paymentMarkClass(
        brand
      )}`}
      aria-label={paymentMarkLabel(brand)}
      title={paymentMarkLabel(brand)}
    >
      {brand === 'mastercard' ? (
        <span className="relative mr-1 inline-flex h-4 w-7 items-center">
          <span className="absolute left-0 h-4 w-4 rounded-full bg-red-500 opacity-95" />
          <span className="absolute right-0 h-4 w-4 rounded-full bg-amber-400 opacity-95 mix-blend-multiply" />
        </span>
      ) : null}
      {brand === 'contactless' ? <span className="mr-1 text-base leading-none">)))</span> : null}
      <span>{paymentMarkText(brand, compact)}</span>
    </span>
  );
}

function paymentMarkLabel(brand: CardBrand | 'apple-pay' | 'contactless') {
  if (brand === 'apple-pay') return 'Apple Pay';
  if (brand === 'contactless') return 'Contactless';
  return brandLabels[brand];
}

function paymentMarkText(brand: CardBrand | 'apple-pay' | 'contactless', compact: boolean) {
  switch (brand) {
    case 'visa':
      return 'VISA';
    case 'mastercard':
      return compact ? 'MC' : 'Mastercard';
    case 'amex':
      return compact ? 'AMEX' : 'American Express';
    case 'discover':
      return compact ? 'DISC' : 'Discover';
    case 'jcb':
      return 'JCB';
    case 'diners':
      return compact ? 'DC' : 'Diners Club';
    case 'apple-pay':
      return 'Apple Pay';
    case 'contactless':
      return compact ? 'Tap' : 'Contactless';
    default:
      return 'CARD';
  }
}

function paymentMarkClass(brand: CardBrand | 'apple-pay' | 'contactless') {
  switch (brand) {
    case 'visa':
      return 'border-blue-200 bg-blue-700 text-white';
    case 'mastercard':
      return 'border-slate-200 bg-white text-slate-900';
    case 'amex':
      return 'border-sky-200 bg-sky-600 text-white';
    case 'discover':
      return 'border-orange-200 bg-gradient-to-r from-white via-orange-100 to-orange-500 text-slate-900';
    case 'jcb':
      return 'border-emerald-200 bg-gradient-to-r from-blue-600 via-red-600 to-emerald-600 text-white';
    case 'diners':
      return 'border-cyan-200 bg-cyan-700 text-white';
    case 'apple-pay':
      return 'border-slate-300 bg-black text-white';
    case 'contactless':
      return 'border-slate-300 bg-white text-slate-900';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-500';
  }
}

export function CardNumberInput({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
}) {
  const brand = detectCardBrand(value);

  return (
    <div>
      <label className="label">Card number</label>
      <div className="relative">
        <input
          name="cardNumber"
          inputMode="numeric"
          autoComplete="cc-number"
          value={value}
          onChange={(event) => onChange(formatCardNumber(event.target.value))}
          onBlur={onBlur}
          className={`input pr-24 ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
          placeholder={brand === 'amex' ? '0000 000000 00000' : '0000 0000 0000 0000'}
          aria-invalid={Boolean(error)}
        />
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
          <CardTypeBadge brand={brand} />
        </div>
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

export function ExpiryInput({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
}) {
  return (
    <div>
      <label className="label">Expiry</label>
      <input
        name="cardExpiry"
        inputMode="numeric"
        autoComplete="cc-exp"
        value={value}
        onChange={(event) => onChange(formatExpiry(event.target.value))}
        onBlur={onBlur}
        className={`input ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
        placeholder="MM/YY"
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

export function SecurityCodeInput({
  value,
  onChange,
  onBlur,
  brand,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  brand: CardBrand;
  error?: string;
}) {
  const isAmex = brand === 'amex';

  return (
    <div>
      <label className="label">{isAmex ? 'CID' : 'CVV'}</label>
      <input
        name="cardCvv"
        inputMode="numeric"
        autoComplete="cc-csc"
        value={value}
        onChange={(event) => onChange(digitsOnly(event.target.value).slice(0, isAmex ? 4 : 3))}
        onBlur={onBlur}
        className={`input ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
        placeholder={isAmex ? '1234' : '123'}
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
