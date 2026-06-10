import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { apiService } from '../../infrastructure/api';
import { toLocalDatetime } from '../../infrastructure/time';
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
  const [canDelete, setCanDelete] = useState(false);
  const [userRole, setUserRole] = useState(null);

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

  useEffect(() => {
    apiService.getMe()
      .then(user => {
        setCanDelete(user.role === 'admin');
        setUserRole(user.role);
      })
      .catch(() => setCanDelete(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!authorName.trim() || !newComment.trim() || sending) return;
    setSending(true);
    try {
      const comment = await apiService.createTherapyComment(therapyId, authorName.trim(), newComment.trim());
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

  // canDelete is now set via getMe() on mount

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '20px 24px', marginTop: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <MessageSquare size={20} color="var(--secondary)" />
        <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Comentarios / Notas de Enfermería</h3>
      </div>

      {error && (
        <div className="message-box message-error" style={{ marginBottom: '12px' }}>{error}</div>
      )}

      <div style={{
        maxHeight: '300px',
        overflowY: 'auto',
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '20px' }}>
            <Clock size={20} style={{ animation: 'pulse 1.5s infinite' }} />
            <p style={{ marginTop: '8px', fontSize: '0.85rem' }}>Cargando comentarios...</p>
          </div>
        )}
        {!loading && comments.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '20px', fontSize: '0.85rem' }}>
            No hay comentarios aún. Añada el primer comentario usando el formulario de abajo.
          </div>
        )}
        {!loading && comments.map(comment => (
          <div key={comment.id} className="comment-card" style={{
            background: 'var(--bg-inset)',
            borderRadius: '12px',
            padding: '14px 16px',
            border: '1px solid var(--border-default)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={14} color="var(--secondary)" />
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{comment.author_name}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                  {toLocalDatetime(comment.created_at)}
                </span>
              </div>
              {canDelete && (
                <button
                  onClick={() => setDeleteTarget(comment.id)}
                  className="btn btn-sm"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: 'var(--danger)',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    transition: 'all 0.15s ease',
                  }}
                  title="Eliminar comentario"
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; }}
                >
                  <Trash2 size={11} /> Eliminar
                </button>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {comment.comment}
            </p>
          </div>
        ))}
      </div>

      {userRole !== 'viewer' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="text"
            className="input"
            placeholder="Nombre del personal de salud *"
            value={authorName}
            onChange={e => setAuthorName(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea
              className="input"
              placeholder="Escriba su comentario aquí..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              rows={2}
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem', resize: 'none' }}
            />
            <button
              type="submit"
              disabled={!authorName.trim() || !newComment.trim() || sending}
              className="btn"
              style={{
                background: (!authorName.trim() || !newComment.trim()) ? 'var(--btn-bg)' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                color: (!authorName.trim() || !newComment.trim()) ? 'var(--text-tertiary)' : 'white',
                cursor: (!authorName.trim() || !newComment.trim()) ? 'default' : 'pointer',
              }}
            >
              <Send size={16} /> {sending ? '...' : 'Enviar'}
            </button>
          </div>
        </form>
      )}

      {deleteTarget !== null && createPortal(
        <div className="modal-backdrop" onClick={() => { if (!deleting) { setDeleteTarget(null); setDeleteReason(''); } }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '24px', maxWidth: '420px' }}>
            <div className="modal-header">
              <h4 style={{ margin: 0, fontSize: '1rem' }}>Eliminar comentario</h4>
              <button onClick={() => { setDeleteTarget(null); setDeleteReason(''); }} disabled={deleting} className="modal-close">
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Indique el motivo por el que se elimina este comentario:
            </p>
            <textarea
              className="input"
              placeholder="Motivo de eliminación *"
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
              rows={3}
              style={{ resize: 'none' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => { setDeleteTarget(null); setDeleteReason(''); }} disabled={deleting} className="btn btn-ghost">
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={!deleteReason.trim() || deleting}
                className="btn btn-danger"
                style={{ opacity: !deleteReason.trim() ? 0.5 : 1 }}
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
