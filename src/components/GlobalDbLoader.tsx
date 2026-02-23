import { AnimatePresence, motion } from "framer-motion";

type GlobalDbLoaderProps = {
  visible: boolean;
};

export default function GlobalDbLoader({ visible }: GlobalDbLoaderProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="global-db-loader"
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          role="status"
          aria-live="polite"
        >
          <span className="global-db-loader-pulse" aria-hidden="true" />
          <div className="global-db-loader-copy">
            <strong>Consultando base de datos</strong>
            <small>Sincronizando informacion...</small>
          </div>
          <span className="global-db-loader-bar" aria-hidden="true" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
