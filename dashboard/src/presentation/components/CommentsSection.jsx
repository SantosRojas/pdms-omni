import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../infrastructure/api';
import { MessageSquare, Send, Trash2, User, Clock, X } from 'lucide-react';

export const CommentsSection = ({ therapyId }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authorName, setAuthorName] = useState('');
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!therapyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getTherapyComments(therapyId);
      setComments(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [therapyId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!authorName.trim() || !newComment.trim() || sending) return;
    setSending(true);
    try {
      const comment = await apiService.createTherapyComment(
        therapyId,
        authorName.trim(),
        newComment.trim(),
      );
      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !deleteReason.trim() || deleting) return;
    setDeleting(true);
    try {
      await apiService.deleteTherapyComment(deleteTarget, deleteReason.trim());
      setComments(prev => prev.filter(c => c.id !== deleteTarget));
      setDeleteTarget(null);
      setDeleteReason('');
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = () => {
    const user = apiService.getToken();
    const payload = user ? JSON.parse(atob(user.split('.')[1])) : null;
    return payload?.role === 'admin';
  };

  return (
    <div className="glass-panel" style={{ padding: '20px 24px', marginTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <MessageSquare size={20} color="var(--secondary)" />
        <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Comentarios / Notas de Enfermería</h3>
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {/* Comments list */}
      <div style={{
        maxHeight: '300px',
        overflowY: 'auto',
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
            <Clock size={20} style={{ animation: 'pulse 1.5s infinite' }} />
            <p style={{ marginTop: '8px', fontSize: '0.85rem' }}>Cargando comentarios...</p>
          </div>
        )}
        {!loading && comments.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.85rem' }}>
            No hay comentarios aún. Añada el primer comentario usando el formulario de abajo.
          </div>
        )}
        {!loading && comments.map(comment => (
          <div key={comment.id} style={{
            background: 'var(--input-bg)',
            borderRadius: '10px',
            padding: '12px 16px',
            border: '1px solid var(--border)',
            position: 'relative',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={14} color="var(--secondary)" />
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{comment.author_name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {comment.created_at}
                </span>
              </div>
              {canDelete() && (
                <button
                  onClick={() => setDeleteTarget(comment.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    padding: '2px',
                    opacity: 0.6,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseOver={e => e.currentTarget.style.opacity = '1'}
                  onMouseOut={e => e.currentTarget.style.opacity = '0.6'}
                  title="Eliminar comentario"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {comment.comment}
            </p>
          </div>
        ))}
      </div>

      {/* New comment form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          type="text"
          placeholder="Nombre del personal de salud *"
          value={authorName}
          onChange={e => setAuthorName(e.target.value)}
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '8px 12px',
            color: 'var(--text-main)',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-family)',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            placeholder="Escriba su comentario aquí..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            rows={2}
            style={{
              flex: 1,
              background: 'var(--input-bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '8px 12px',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-family)',
              outline: 'none',
              resize: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!authorName.trim() || !newComment.trim() || sending}
            style={{
              background: (!authorName.trim() || !newComment.trim()) ? 'var(--btn-bg)' : 'linear-gradient(135deg, var(--primary), #6366f1)',
              border: 'none',
              borderRadius: '10px',
              padding: '8px 16px',
              color: (!authorName.trim() || !newComment.trim()) ? 'var(--text-muted)' : 'white',
              cursor: (!authorName.trim() || !newComment.trim()) ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-family)',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            <Send size={16} /> {sending ? '...' : 'Enviar'}
          </button>
        </div>
      </form>

      {/* Delete confirmation modal */}
      {deleteTarget !== null && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => { if (!deleting) { setDeleteTarget(null); setDeleteReason(''); } }}>
          <div style={{
            background: 'var(--bg-main)',
            borderRadius: '12px',
            padding: '24px',
            width: '400px',
            maxWidth: '90vw',
            border: '1px solid var(--border)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '1rem' }}>Eliminar comentario</h4>
              <button
                onClick={() => { setDeleteTarget(null); setDeleteReason(''); }}
                disabled={deleting}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Indique el motivo por el que se elimina este comentario:
            </p>
            <textarea
              placeholder="Motivo de eliminación *"
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '8px 12px',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-family)',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => { setDeleteTarget(null); setDeleteReason(''); }}
                disabled={deleting}
                style={{
                  background: 'var(--btn-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={!deleteReason.trim() || deleting}
                style={{
                  background: !deleteReason.trim() ? 'var(--btn-bg)' : 'var(--danger)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  color: !deleteReason.trim() ? 'var(--text-muted)' : 'white',
                  cursor: !deleteReason.trim() ? 'default' : 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
