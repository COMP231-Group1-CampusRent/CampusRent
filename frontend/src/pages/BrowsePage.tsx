import { useEffect, useState } from 'react';
import { api, Listing } from '../api/client';
import ListingCard from '../components/ListingCard';
import { Search, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BrowsePage() {
  const { isVerified } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [guestPreview, setGuestPreview] = useState(false);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      if (availability && isVerified) params.set('availability', availability);
      const res = await api.get<{
        listings: Listing[];
        guest_preview: boolean;
      }>(`/listings?${params}`);
      setListings(res.listings);
      setGuestPreview(res.guest_preview);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get<string[]>('/listings/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    fetchListings();
  }, [category, availability, isVerified]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchListings();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-900">Browse Listings</h1>
        <p className="mt-1 text-slate-500">
          {guestPreview
            ? 'Limited preview — register to see full details and request rentals.'
            : 'Discover items available for rent from verified students.'}
        </p>
      </div>

      <div className="card mb-8">
        <form onSubmit={handleSearch} className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-10"
                placeholder="Search by keyword..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <div className="w-full lg:w-48">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
            <select
              className="input-field"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {isVerified && (
            <div className="w-full lg:w-40">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Availability</label>
              <select
                className="input-field"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
              >
                <option value="">All</option>
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          )}
          <button type="submit" className="btn-primary">
            <Filter className="h-4 w-4" /> Search
          </button>
        </form>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-lg font-medium text-slate-600">No listings found</p>
          <p className="mt-1 text-sm text-slate-400">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
