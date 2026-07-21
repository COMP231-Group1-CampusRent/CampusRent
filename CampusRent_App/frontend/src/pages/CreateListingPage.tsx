import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function CreateListingPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    rental_terms: '',
    availability: 'available',
  });
  const [images, setImages] = useState<FileList | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<string[]>('/listings/categories').then(setCategories).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (images) {
        for (let i = 0; i < Math.min(images.length, 5); i++) {
          fd.append('images', images[i]);
        }
      }
      const listing = await api.upload<{ id: number }>('/listings', fd);
      navigate(`/listings/${listing.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-slate-900">List an Item</h1>
      <p className="mt-1 text-slate-500">Offer something for temporary use to fellow students</p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Title *</label>
          <input
            className="input-field"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Category *</label>
          <select
            className="input-field"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description *</label>
          <textarea
            className="input-field min-h-[100px]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Rental Terms</label>
          <textarea
            className="input-field min-h-[60px]"
            value={form.rental_terms}
            onChange={(e) => setForm({ ...form, rental_terms: e.target.value })}
            placeholder="Pickup location, duration limits, etc."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Images (max 5, JPG/PNG/WEBP)</label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            multiple
            className="input-field"
            onChange={(e) => setImages(e.target.files)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Creating...' : 'Create Listing'}
        </button>
      </form>
    </div>
  );
}
