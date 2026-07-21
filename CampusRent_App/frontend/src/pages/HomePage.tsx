import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Shield, Users, Recycle } from 'lucide-react';

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-campus-900 via-campus-800 to-campus-700 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggIGQ9Ik0zNiAzNGg0djJoLTR6bTAtNGg0djJoLTR6bTAtNGg0djJoLTR6bTAtNGg0djJoLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur">
              <BookOpen className="h-4 w-4" /> Built for students, by students
            </p>
            <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              Rent what you need.
              <span className="block text-campus-200">Share what you have.</span>
            </h1>
            <p className="mt-6 text-lg text-campus-100/90 leading-relaxed">
              CampusRent connects verified students to borrow textbooks, electronics, lab equipment,
              and more — safely within your campus community.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/browse" className="btn-primary !bg-white !text-campus-800 hover:!bg-campus-50">
                Browse Items <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/register" className="btn-secondary !border-white/30 !bg-white/10 !text-white hover:!bg-white/20">
                Join with School Email
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              icon: Shield,
              title: 'Verified Students Only',
              desc: 'Register with your institutional email. Admins verify every account before rental access.',
            },
            {
              icon: Users,
              title: 'Direct Coordination',
              desc: 'Message owners, submit rental requests, and coordinate pickup — all in one platform.',
            },
            {
              icon: Recycle,
              title: 'Sustainable Sharing',
              desc: 'Reduce waste and save money by reusing items your peers already own.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-campus-50 text-campus-600">
                <Icon className="h-7 w-7" />
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-campus-50/50 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <h2 className="font-display text-3xl font-bold text-campus-900">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {['Register & get verified', 'Browse or list items', 'Request & coordinate', 'Complete & review'].map(
              (step, i) => (
                <div key={step} className="relative">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-campus-600 text-sm font-bold text-white">
                    {i + 1}
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-700">{step}</p>
                </div>
              )
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
