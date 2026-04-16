'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { TEMPLATES, TemplateId } from '@/lib/templates';

interface TemplateGalleryProps {
  selectedId: TemplateId;
  onSelect: (id: TemplateId) => void;
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({ selectedId, onSelect }) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TEMPLATES.map((template) => {
        const IconComponent = (LucideIcons as any)[template.icon] || LucideIcons.FileVideo;
        const isSelected = selectedId === template.id;

        return (
          <motion.div
            key={template.id}
            whileHover={{ scale: 1.03, translateY: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(template.id)}
            className={`relative group cursor-pointer border transition-all duration-300 p-3 flex flex-col items-center justify-center text-center gap-2 overflow-hidden rounded-md ${
              isSelected
                ? 'border-yellow-400 bg-yellow-400/10 shadow-[0_0_15px_rgba(250,204,21,0.15)]'
                : 'border-white/5 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
            }`}
          >
            {/* Background Accent */}
            {isSelected && (
              <motion.div
                layoutId="active-template-bg"
                className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-transparent pointer-events-none"
              />
            )}

            {/* Icon */}
            <div className={`p-2 rounded-full transition-colors ${
              isSelected ? 'bg-yellow-400 text-black' : 'bg-white/5 text-white/40 group-hover:text-white/70'
            }`}>
              <IconComponent size={20} strokeWidth={2.5} />
            </div>

            {/* Label */}
            <div className="space-y-0.5 z-10">
              <h4 className={`text-[12px] font-bold font-mono tracking-tight transition-colors ${
                isSelected ? 'text-yellow-400' : 'text-white/60'
              }`}>
                {template.label}
              </h4>
              <p className={`text-[9px] text-white/25 leading-tight px-1 line-clamp-1 group-hover:opacity-100 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                {template.description}
              </p>
            </div>

            {/* Selection Indicator */}
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute top-1.5 right-1.5"
                >
                  <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_8px_#facc15]" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
};
