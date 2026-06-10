import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn } from 'lucide-react';

/**
 * Lightbox untuk zoom foto.
 * Props: src, alt, onClose
 */
export default function ImageLightbox({ src, alt = 'foto', onClose }) {
  // Tutup dengan Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
        >
          <X size={20} className="text-white" />
        </button>
        <motion.img
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          src={src}
          alt={alt}
          className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
          onClick={e => e.stopPropagation()}
        />
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Wrapper gambar yang bisa di-klik untuk zoom.
 */
export function ZoomableImage({ src, alt, className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="relative group cursor-zoom-in" onClick={() => setOpen(true)}>
        <img src={src} alt={alt} className={className} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl flex items-center justify-center">
          <ZoomIn size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
        </div>
      </div>
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
