import * as React from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/api/attachments';

export interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  acceptedTypes?: string[];
  maxSizeBytes?: number;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ACCEPTED_TYPES = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.txt',
];

export function FileUpload({
  onUpload,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  disabled = false,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${formatFileSize(maxSizeBytes)} limit`;
    }

    // Check file type
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    const acceptedExtensions = acceptedTypes.map((t) => t.toLowerCase());
    if (!acceptedExtensions.some((ext) => fileExtension === ext || file.type.includes(ext.replace('.', '')))) {
      return `File type not accepted. Allowed: ${acceptedTypes.join(', ')}`;
    }

    return null;
  };

  const handleFile = async (file: File) => {
    setError(null);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);

    try {
      await onUpload(file);
      setSelectedFile(null);
    } catch {
      setError('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          isDragging && 'border-primary-500 bg-primary-50',
          !isDragging && !disabled && 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50',
          disabled && 'border-neutral-200 bg-neutral-50 cursor-not-allowed opacity-60',
          isUploading && 'cursor-wait'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <div className="space-y-2">
            <Loader2 className="mx-auto h-8 w-8 text-primary-500 animate-spin" />
            <p className="text-sm text-neutral-600">
              Uploading {selectedFile?.name}...
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="mx-auto h-8 w-8 text-neutral-400" />
            <div>
              <p className="text-sm font-medium text-neutral-700">
                Drop a file here, or{' '}
                <span className="text-primary-600">browse</span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {acceptedTypes.join(', ')} up to {formatFileSize(maxSizeBytes)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Selected file preview (before upload) */}
      {selectedFile && !isUploading && (
        <div className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg border border-neutral-200">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm text-neutral-700 truncate">{selectedFile.name}</span>
            <span className="text-xs text-neutral-500 flex-shrink-0">
              ({formatFileSize(selectedFile.size)})
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              handleClearFile();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-error">{error}</p>
      )}
    </div>
  );
}

export default FileUpload;
