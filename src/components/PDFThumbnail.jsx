import React, { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Point pdf.js worker to the bundled worker file
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const PDFThumbnail = ({ fileUrl, width = 200, height = 160 }) => {
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const renderFirstPage = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const pdf = await getDocument(fileUrl).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(width / viewport.width, height / viewport.height);
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const context = canvas.getContext('2d');
        await page.render({
          canvasContext: context,
          viewport: scaledViewport
        }).promise;
      } catch (error) {
        console.error('PDF thumbnail render error:', error);
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    renderFirstPage();

    return () => {
      cancelled = true;
    };
  }, [fileUrl, width, height]);

  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #fff, #f8f9fa)',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)',
        border: '1px solid rgba(213, 171, 93, 0.3)'
      }}
    >
      {isLoading && (
        <span style={{ color: '#182E37', fontWeight: 600, fontSize: '0.9rem' }}>
          Loading…
        </span>
      )}
      {hasError && (
        <span style={{ color: '#b00020', fontWeight: 600, fontSize: '0.9rem' }}>
          Preview unavailable
        </span>
      )}
      <canvas
        ref={canvasRef}
        style={{
          display: isLoading || hasError ? 'none' : 'block',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
};

export default PDFThumbnail;
