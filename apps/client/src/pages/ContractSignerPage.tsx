import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { FileText, Loader2 } from 'lucide-react';

const ContractSignerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContract = async () => {
      try {
        const res = await api.get(`/contracts/instances/${id}`);
        const instance = res.data;

        if (instance.docusealSignUrl) {
          window.location.assign(instance.docusealSignUrl);
          return;
        }

        // Check if already signed
        if (instance.status === 'signed') {
          setError('Este contrato ya ha sido firmado completamente.');
          setLoading(false);
          return;
        }

        setError('No se encontró una URL de firma válida para este contrato.');
      } catch (err: any) {
        console.error('Failed to load contract:', err);
        setError('Error al cargar el contrato. Es posible que no tengas permisos para verlo.');
      } finally {
        setLoading(false);
      }
    };

    if (id && user) {
      loadContract();
    } else if (!user) {
      setError('Debes iniciar sesión para firmar este contrato.');
      setLoading(false);
    }
  }, [id, user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-brand-500 mb-4" />
        <p className="text-gray-600 font-medium text-center">Te estamos redirigiendo a la firma segura...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-surface rounded-[32px] shadow-soft border border-border text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500 border border-red-100">
          <FileText size={32} />
        </div>
        <h1 className="text-2xl font-display text-text mb-4">Error de Contrato</h1>
        <p className="text-text-muted mb-8">{error}</p>
        <button
          onClick={() => navigate('/bookings')}
          className="w-full py-4 bg-brand-500 text-white rounded-2xl font-semibold hover:bg-brand-600 transition-all shadow-lift active:scale-95"
        >
          Volver a Mis Reservas
        </button>
      </div>
    );
  }

  return null;
};

export default ContractSignerPage;
