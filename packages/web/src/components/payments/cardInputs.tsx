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

const brandMarks: Record<CardBrand, string> = {
  visa: 'VISA',
  mastercard: 'MC',
  amex: 'AMEX',
  discover: 'DISC',
  jcb: 'JCB',
  diners: 'DC',
  unknown: 'CARD',
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

export function CardTypeBadge({ brand }: { brand: CardBrand }) {
  const brandClass =
    brand === 'unknown'
      ? 'border-slate-200 bg-slate-50 text-slate-500'
      : 'border-primary-200 bg-primary-50 text-primary-700';

  return (
    <span
      className={`inline-flex h-7 min-w-14 items-center justify-center rounded-md border px-2 text-[10px] font-bold tracking-wide ${brandClass}`}
      aria-label={`Detected card type: ${brandLabels[brand]}`}
      title={brandLabels[brand]}
    >
      {brandMarks[brand]}
    </span>
  );
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
