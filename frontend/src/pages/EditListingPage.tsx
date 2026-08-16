import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, Listing } from '../api/client';

export default function EditListingPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    rental_terms: '',
    availability: 'available',
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<string[]>('/listings/categories')
      .then(setCategories)
      .catch(() => {});

    api
      .get<Listing>(`/listings/${id}`)
      .then((listing) =>
        setForm({
          title: listing.title,
          category: listing.category,
          description: listing.description,
          rental_terms: listing.rental_terms ?? '',
          availability: listing.availability ?? 'available',
        })
      )
      .catch(() => navigate('/profile'));
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      await api.put(`/listings/${id}`, form);
      navigate(`/listings/${id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Update failed'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = confirm(
      'Are you sure you want to remove this listing?'
    );

    if (!confirmed) {
      return;
    }

    setError('');

    try {
      await api.delete(`/listings/${id}`);
      navigate('/profile');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Delete failed'
      );
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-slate-900">
        Edit Listing
      </h1>

      <form
        onSubmit={handleSubmit}
        className="card mt-6 space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">
            Title
          </label>

          <input
            className="input-field"
            value={form.title}
            onChange={(e) =>
              setForm({
                ...form,
                title: e.target.value,
              })
            }
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Category
          </label>

          <select
            className="input-field"
            value={form.category}
            onChange={(e) =>
              setForm({
                ...form,
                category: e.target.value,
              })
            }
            required
          >
            {categories.map((category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Description
          </label>

          <textarea
            className="input-field min-h-[100px]"
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description: e.target.value,
              })
            }
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Rental Terms
          </label>

          <textarea
            className="input-field"
            value={form.rental_terms}
            onChange={(e) =>
              setForm({
                ...form,
                rental_terms: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Availability
          </label>

          <select
            className="input-field"
            value={form.availability}
            onChange={(e) =>
              setForm({
                ...form,
                availability: e.target.value,
              })
            }
            required
          >
            <option value="available">
              Available
            </option>

            <option value="unavailable">
              Unavailable
            </option>
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={loading}
          >
            {loading
              ? 'Saving...'
              : 'Save Changes'}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="btn-danger"
            disabled={loading}
          >
            Remove
          </button>
        </div>
      </form>
    </div>
  );
}