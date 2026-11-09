'use client';

import { useState, type FormEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';

type Inquiry = {
  name: string;
  email: string;
  service: string;
  budget: string;
  brief: string;
};

type InquiryField = keyof Inquiry;
type InquiryErrors = Partial<Record<InquiryField, string>>;

const initialInquiry: Inquiry = { name: '', email: '', service: '', budget: '', brief: '' };

function validateField(field: InquiryField, value: string): string {
  if (!value.trim()) return 'This field is required.';
  if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
  if (field === 'brief' && value.trim().length < 20) return 'Add a little more detail (at least 20 characters).';
  return '';
}

export default function PortfolioInquiryForm() {
  const [inquiry, setInquiry] = useState(initialInquiry);
  const [touched, setTouched] = useState<Partial<Record<InquiryField, boolean>>>({});
  const [errors, setErrors] = useState<InquiryErrors>({});

  function updateField(field: InquiryField, value: string) {
    setInquiry((current) => ({ ...current, [field]: value }));
    if (touched[field]) setErrors((current) => ({ ...current, [field]: validateField(field, value) }));
  }

  function handleBlur(field: InquiryField) {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validateField(field, inquiry[field]) }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = (Object.keys(inquiry) as InquiryField[]).reduce<InquiryErrors>((current, field) => {
      const error = validateField(field, inquiry[field]);
      if (error) current[field] = error;
      return current;
    }, {});
    setTouched({ name: true, email: true, service: true, budget: true, brief: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const message = [
      'Hello, I would like to discuss a project.',
      `Name: ${inquiry.name.trim()}`,
      `Email: ${inquiry.email.trim()}`,
      `Service: ${inquiry.service}`,
      `Budget: ${inquiry.budget}`,
      `Brief: ${inquiry.brief.trim()}`,
    ].join('\n');
    window.location.assign(`https://wa.me/2348037212445?text=${encodeURIComponent(message)}`);
  }

  return (
    <form className="inquiry-form" onSubmit={handleSubmit} noValidate>
      <div className="form-heading"><span className="mono">PROJECT INTAKE / 01</span><span className="form-required">* Required</span></div>
      <div className="form-grid">
        <label className="form-field">
          <span>Name <b>*</b></span>
          <input className="field-control" name="name" autoComplete="name" value={inquiry.name} onChange={(event) => updateField('name', event.target.value)} onBlur={() => handleBlur('name')} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} />
          {errors.name && <span className="field-error" id="name-error">{errors.name}</span>}
        </label>
        <label className="form-field">
          <span>Work email <b>*</b></span>
          <input className="field-control" type="email" name="email" autoComplete="email" value={inquiry.email} onChange={(event) => updateField('email', event.target.value)} onBlur={() => handleBlur('email')} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} />
          {errors.email && <span className="field-error" id="email-error">{errors.email}</span>}
        </label>
        <label className="form-field">
          <span>Project type <b>*</b></span>
          <select className="field-control" name="service" value={inquiry.service} onChange={(event) => updateField('service', event.target.value)} onBlur={() => handleBlur('service')} aria-invalid={Boolean(errors.service)} aria-describedby={errors.service ? 'service-error' : undefined}>
            <option value="">Select a service</option>
            <option>MT5 quantitative system</option>
            <option>Fintech application</option>
            <option>Code audit or optimization</option>
            <option>Other engineering brief</option>
          </select>
          {errors.service && <span className="field-error" id="service-error">{errors.service}</span>}
        </label>
        <label className="form-field">
          <span>Budget range <b>*</b></span>
          <select className="field-control" name="budget" value={inquiry.budget} onChange={(event) => updateField('budget', event.target.value)} onBlur={() => handleBlur('budget')} aria-invalid={Boolean(errors.budget)} aria-describedby={errors.budget ? 'budget-error' : undefined}>
            <option value="">Select a range</option>
            <option>Under $2,500</option>
            <option>$2,500–$5,000</option>
            <option>$5,000–$10,000</option>
            <option>$10,000+</option>
            <option>To be scoped</option>
          </select>
          {errors.budget && <span className="field-error" id="budget-error">{errors.budget}</span>}
        </label>
        <label className="form-field form-field-wide">
          <span>What are you building? <b>*</b></span>
          <textarea className="field-control form-textarea" name="brief" rows={3} value={inquiry.brief} onChange={(event) => updateField('brief', event.target.value)} onBlur={() => handleBlur('brief')} aria-invalid={Boolean(errors.brief)} aria-describedby={errors.brief ? 'brief-error' : undefined} placeholder="Goals, constraints, timeline, or the issue to solve..." />
          {errors.brief && <span className="field-error" id="brief-error">{errors.brief}</span>}
        </label>
      </div>
      <div className="form-submit-row"><span className="form-note">Your brief opens as a prefilled WhatsApp message.</span><button className="primary-button form-submit" type="submit">Prepare inquiry <ArrowUpRight size={15} /></button></div>
    </form>
  );
}