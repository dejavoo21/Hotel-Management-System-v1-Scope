import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reviewService } from '@/services';

const sourceLabels: Record<string, string> = {
  DIRECT: 'Direct',
  BOOKING_COM: 'Booking.com',
  EXPEDIA: 'Expedia',
  AIRBNB: 'Airbnb',
  GOOGLE: 'Google',
  TRIPADVISOR: 'TripAdvisor',
  OTHER: 'Other',
};

export default function ReviewsPage() {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => reviewService.list(),
  });

  const stats = useMemo(() => {
    const list = reviews ?? [];
    const total = list.length;
    const average = total > 0 ? list.reduce((sum, review) => sum + review.rating, 0) / total : 0;
    const responded = list.filter((review) => review.response?.length).length;
    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
    const lastWeek = list.filter((review) => {
      const createdAt = new Date(review.createdAt).getTime();
      const sevenDays = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return createdAt >= sevenDays;
    }).length;
    const bySource = list.reduce<Record<string, number>>((acc, review) => {
      acc[review.source] = (acc[review.source] ?? 0) + 1;
      return acc;
    }, {});
    const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0];
    return {
      total,
      average: Number(average.toFixed(1)),
      responseRate,
      lastWeek,
      topSource: topSource ? sourceLabels[topSource[0]] : 'N/A',
    };
  }, [reviews]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reviews</h1>
        <p className="mt-1 text-sm text-slate-500">Monitor guest feedback and reputation performance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">Average rating</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{stats.average}</p>
          <p className="mt-1 text-xs text-slate-500">Across {stats.total} reviews</p>
        </div>
        <div className="card card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">Response rate</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{stats.responseRate}%</p>
          <p className="mt-1 text-xs text-slate-500">Answered reviews</p>
        </div>
        <div className="card card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">Last 7 days</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{stats.lastWeek}</p>
          <p className="mt-1 text-xs text-slate-500">New reviews</p>
        </div>
        <div className="card card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">Top source</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{stats.topSource}</p>
          <p className="mt-1 text-xs text-slate-500">Most frequent channel</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 animate-shimmer rounded-xl" />
          ))}
        </div>
      ) : reviews && reviews.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {reviews.map((review) => (
              <div key={review.id} className="card card-hover">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    {review.guest ? `${review.guest.firstName} ${review.guest.lastName}` : 'Guest'}
                  </p>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {review.rating.toFixed(1)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {review.comment || 'No review details provided.'}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>{sourceLabels[review.source] || review.source}</span>
                  <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                </div>
                {review.response ? (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    Response: {review.response}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900">Reputation summary</h2>
              <p className="text-sm text-slate-500">Key channels performance.</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Direct</span>
                  <span className="font-semibold text-slate-900">
                    {reviews.filter((review) => review.source === 'DIRECT').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Booking.com</span>
                  <span className="font-semibold text-slate-900">
                    {reviews.filter((review) => review.source === 'BOOKING_COM').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Expedia</span>
                  <span className="font-semibold text-slate-900">
                    {reviews.filter((review) => review.source === 'EXPEDIA').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Airbnb</span>
                  <span className="font-semibold text-slate-900">
                    {reviews.filter((review) => review.source === 'AIRBNB').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Google</span>
                  <span className="font-semibold text-slate-900">
                    {reviews.filter((review) => review.source === 'GOOGLE').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900">Response tasks</h2>
              <p className="text-sm text-slate-500">Reviews needing attention.</p>
              <div className="mt-4 space-y-3">
                {reviews
                  .filter((review) => !review.response)
                  .slice(0, 4)
                  .map((review) => (
                    <div key={review.id} className="rounded-xl border border-slate-100 p-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {review.guest ? `${review.guest.firstName} ${review.guest.lastName}` : 'Guest'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {sourceLabels[review.source] || review.source} - {review.rating.toFixed(1)} rating
                      </p>
                    </div>
                  ))}
                {reviews.filter((review) => !review.response).length === 0 ? (
                  <p className="text-sm text-slate-500">All reviews are answered.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-sm text-slate-500">No reviews available.</div>
      )}
    </div>
  );
}
