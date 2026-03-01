import api from '@/services/api';

export async function downloadTranscript(conversationId: string): Promise<void> {
  const id = conversationId.trim();
  if (!id) {
    throw new Error('conversationId is required');
  }

  const response = await api.get(`/conversations/${encodeURIComponent(id)}/transcript.txt`, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `transcript-${id}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
