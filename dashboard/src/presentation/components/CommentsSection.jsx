import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../infrastructure/api';
import { toLocalDatetime } from '../../infrastructure/time';
import { MessageSquare, Send, Trash2, User, Clock } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

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
        <h3 style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>Comentarios / Notas de Enfermería</h3>
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
            <p style={{ marginTop: '8px', fontSize: 'var(--fs-sm)' }}>Cargando comentarios...</p>
          </div>
        )}
        {!loading && comments.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '20px', fontSize: 'var(--fs-sm)' }}>
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
                <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{comment.author_name}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xxs)' }}>
                  {toLocalDatetime(comment.created_at)}
                </span>
              </div>
              {canDelete && (
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleteTarget(comment.id)}
                  style={{ color: 'var(--danger)', padding: '2px 8px' }} title="Eliminar comentario" />
              )}
            </div>
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
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
            style={{ padding: '8px 12px', fontSize: 'var(--fs-sm)' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea
              className="input"
              placeholder="Escriba su comentario aquí..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              rows={2}
              style={{ flex: 1, padding: '8px 12px', fontSize: 'var(--fs-sm)', resize: 'none' }}
            />
            <Button type="submit" variant="primary" icon={Send} disabled={!authorName.trim() || !newComment.trim() || sending}>
              {sending ? '...' : 'Enviar'}
            </Button>
          </div>
        </form>
      )}

      <Modal show={deleteTarget !== null} onClose={() => { if (!deleting) { setDeleteTarget(null); setDeleteReason(''); } }} title="Eliminar comentario" icon={Trash2} iconColor="var(--danger)" size="sm">
        <Modal.Body>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: '12px' }}>
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
        </Modal.Body>
        <Modal.Footer>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => { setDeleteTarget(null); setDeleteReason(''); }} disabled={deleting}>Cancelar</Button>
            <Button variant="danger" onClick={handleDeleteConfirm} disabled={!deleteReason.trim() || deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
