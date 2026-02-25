import { Link } from 'react-router-dom';
import { Shield, FileText, List, AlertCircle, Users } from 'lucide-react';

const cards = [
  {
    title: 'Vehicle Review Queue',
    description: 'Approve or reject publisher vehicles before they go live.',
    to: '/admin/vehicles',
    icon: List,
    accent: 'bg-indigo-100 text-indigo-600'
  },
  {
    title: 'Dispute Resolution',
    description: 'Review evidence kits and settle renter vs publisher conflicts.',
    to: '/admin/disputes',
    icon: AlertCircle,
    accent: 'bg-red-100 text-red-600'
  },
  {
    title: 'Contract Templates',
    description: 'Manage DocuSeal-backed contract templates and signing flows.',
    to: '/admin/templates',
    icon: FileText,
    accent: 'bg-emerald-100 text-emerald-600'
  }
];

export default function AdminDashboard() {
  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-4 bg-black text-white rounded-3xl shadow-xl">
          <Shield size={36} />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-400">Control Center</p>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-slate-500 mt-2">Choose an area below to continue.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map(({ title, description, to, icon: Icon, accent }) => (
          <Link
            key={to}
            to={to}
            className="group bg-white rounded-3xl p-6 border border-slate-100 shadow-md hover:shadow-2xl transition-all flex flex-col gap-4"
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${accent}`}>
              <Icon size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{title}</h2>
              <p className="text-sm text-slate-500 mt-2">{description}</p>
            </div>
            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Go →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
