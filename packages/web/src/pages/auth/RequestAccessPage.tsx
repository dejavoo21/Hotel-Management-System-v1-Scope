import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { accessRequestService } from '@/services';
import toast from 'react-hot-toast';

export default function RequestAccessPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const hasSubmitted = useRef(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || submittedEmail || hasSubmitted.current) {
      return;
    }
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    setIsSubmitting(true);
    try {
      const email = (form.get('email') as string).trim();
      await accessRequestService.create({
        fullName: form.get('fullName') as string,
        email,
        company: (form.get('company') as string) || undefined,
        role: (form.get('role') as string) || undefined,
        message: (form.get('message') as string) || undefined,
      });
      toast.success('Request submitted');
      formEl.reset();
      hasSubmitted.current = true;
      setSubmittedEmail(email);
      navigate(`/request-access?submitted=${encodeURIComponent(email)}`, { replace: true });
    } catch {
      if (!hasSubmitted.current) {
        toast.error('Failed to submit request');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Request access</h2>
        <p className="mt-2 text-sm text-slate-600">
          Tell us about your team and we will reach out with access details.
        </p>
      </div>

      {submittedEmail ? (
        <div className="mt-6 space-y-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-6">
          <div>
            <h3 className="text-lg font-semibold text-emerald-900">Request submitted</h3>
            <p className="mt-2 text-sm text-emerald-800">
              We sent a confirmation to <strong>{submittedEmail}</strong>.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to={`/login?email=${encodeURIComponent(submittedEmail)}`} className="btn-primary text-center flex-1">
              Go to login now
            </Link>
            <Link to="/login" className="btn-outline text-center flex-1">
              Back to login
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">Full name *</label>
            <input name="fullName" required className="input" />
          </div>
          <div>
            <label className="label">Work email *</label>
            <input name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label">Company</label>
            <input name="company" className="input" />
          </div>
          <div>
            <label className="label">Role</label>
            <input name="role" className="input" />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea name="message" rows={4} className="input" />
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Submitting...' : 'Submit request'}
          </button>
          <Link to="/login" className="btn-outline w-full text-center">
            Back to login
          </Link>
        </form>
      )}
    </div>
  );
}
