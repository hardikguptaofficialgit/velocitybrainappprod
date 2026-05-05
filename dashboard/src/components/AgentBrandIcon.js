import React, { useMemo, useState } from 'react';
import {
  getAgentLogoFrameClassName,
  getAgentLogoSources,
} from '../lib/agentLogos';

export default function AgentBrandIcon({
  agentId,
  name,
  className = '',
  imageClassName = '',
  containerClassName = '',
  size = 'h-4 w-4',
}) {
  const sources = useMemo(() => getAgentLogoSources(agentId), [agentId]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const activeSource = sources[sourceIndex];

  const handleError = () => {
    setSourceIndex((current) => (current + 1 < sources.length ? current + 1 : current));
  };

  return (
    <div
      className={`flex items-center justify-center rounded-lg border ${getAgentLogoFrameClassName(agentId)} ${containerClassName}`.trim()}
    >
      {activeSource ? (
        <img
          src={activeSource}
          alt={`${name} logo`}
          className={`${size} object-contain ${imageClassName}`.trim()}
          loading="lazy"
          onError={handleError}
        />
      ) : (
        <span className={`text-[10px] font-semibold uppercase text-zinc-300 ${className}`.trim()}>
          {name?.slice(0, 1) || '?'}
        </span>
      )}
    </div>
  );
}
