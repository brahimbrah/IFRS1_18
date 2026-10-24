import { Link } from 'react-router-dom';
import { FolderOpen, PlusCircle } from 'lucide-react';
import { Card, EmptyState } from './ui';

export default function NoDossier({ hint }: { hint?: string }) {
  return (
    <Card>
      <EmptyState
        icon={<FolderOpen className="h-6 w-6" />}
        title="Aucun dossier sélectionné"
        description={hint || 'Sélectionnez un dossier dans la barre supérieure, créez une nouvelle conversion ou lancez une démonstration pour commencer.'}
        action={
          <Link to="/nouvelle-conversion" className="btn-primary">
            <PlusCircle className="h-4 w-4" />
            Nouvelle conversion
          </Link>
        }
      />
    </Card>
  );
}
