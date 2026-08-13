import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { UserProfile, Workspace } from '@/domain/entities';
import type { RepositoryStore } from '@/domain/repositories';
import { WorkspaceService } from '@/features/workspace/services/workspace-service';

import { useOnboarding } from './onboarding-provider';

type WorkspaceContextValue = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  workspace: Workspace | null;
  profile: UserProfile | null;
  errorMessage: string | null;
  retry: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined,
);

type WorkspaceProviderProps = PropsWithChildren<{
  repositories: RepositoryStore | null;
}>;

export function WorkspaceProvider({
  repositories,
  children,
}: WorkspaceProviderProps) {
  const onboarding = useOnboarding();
  const [status, setStatus] = useState<WorkspaceContextValue['status']>('idle');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const service = useMemo(
    () => (repositories ? new WorkspaceService(repositories) : null),
    [repositories],
  );

  const load = useCallback(async () => {
    if (!service || onboarding.status !== 'complete') {
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    try {
      const result = await service.ensurePersonalWorkspace();
      setWorkspace(result.workspace);
      setProfile(result.profile);
      setStatus('ready');
    } catch {
      setStatus('error');
      setErrorMessage(
        'Planora could not prepare your local planning space. Your data has not been changed.',
      );
    }
  }, [onboarding.status, service]);

  useEffect(() => {
    if (service && onboarding.status === 'complete') {
      void load();
    } else {
      setStatus('idle');
      setWorkspace(null);
      setProfile(null);
    }
  }, [load, onboarding.status, service]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({ status, workspace, profile, errorMessage, retry: load }),
    [errorMessage, load, profile, status, workspace],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used within WorkspaceProvider.');
  return value;
}
