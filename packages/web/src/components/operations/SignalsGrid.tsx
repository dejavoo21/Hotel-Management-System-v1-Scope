import type { OperationsContext } from '@/services/operations';
import ArrivalsSignalCard from './signals/ArrivalsSignalCard';
import DemandSignalCard from './signals/DemandSignalCard';
import PricingSignalCard from './signals/PricingSignalCard';
import WeatherSignalCard from './signals/WeatherSignalCard';

type Props = {
  context?: OperationsContext | null;
  onRefreshWeather?: () => void;
  isRefreshingWeather?: boolean;
};

export default function SignalsGrid({ context, onRefreshWeather, isRefreshingWeather = false }: Props) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">Predictive Signals</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <WeatherSignalCard context={context} onRefresh={onRefreshWeather} isRefreshing={isRefreshingWeather} />
        <ArrivalsSignalCard context={context} />
        <DemandSignalCard context={context} />
        <PricingSignalCard context={context} />
      </div>
    </div>
  );
}
