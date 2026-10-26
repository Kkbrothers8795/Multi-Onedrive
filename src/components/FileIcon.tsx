import React from 'react';
import {
  Folder,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Video,
  Music,
  File as GenericFile,
} from 'lucide-react';
import { FileCategory } from '../types/drive';

interface FileIconProps {
  type: FileCategory;
  className?: string;
  size?: number;
}

export const FileIcon: React.FC<FileIconProps> = ({ type, className = '', size = 20 }) => {
  switch (type) {
    case 'folder':
      return <Folder size={size} className={`text-amber-500 fill-amber-500/20 ${className}`} />;
    case 'document':
      return <FileText size={size} className={`text-blue-500 fill-blue-500/20 ${className}`} />;
    case 'spreadsheet':
      return <FileSpreadsheet size={size} className={`text-emerald-500 fill-emerald-500/20 ${className}`} />;
    case 'presentation':
      return <Presentation size={size} className={`text-orange-500 fill-orange-500/20 ${className}`} />;
    case 'pdf':
      return <FileText size={size} className={`text-rose-500 fill-rose-500/20 ${className}`} />;
    case 'image':
      return <ImageIcon size={size} className={`text-purple-500 fill-purple-500/20 ${className}`} />;
    case 'video':
      return <Video size={size} className={`text-sky-500 fill-sky-500/20 ${className}`} />;
    case 'audio':
      return <Music size={size} className={`text-indigo-500 fill-indigo-500/20 ${className}`} />;
    case 'archive':
      return <FileArchive size={size} className={`text-amber-600 fill-amber-600/20 ${className}`} />;
    case 'code':
      return <FileCode size={size} className={`text-teal-500 fill-teal-500/20 ${className}`} />;
    default:
      return <GenericFile size={size} className={`text-slate-400 fill-slate-400/20 ${className}`} />;
  }
};
