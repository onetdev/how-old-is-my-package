import { clsx } from 'clsx';
import { FunctionComponent, useMemo } from 'react';
import DataTable, {
  ConditionalStyles,
  TableColumn,
} from 'react-data-table-component';
import { ExternalLink } from 'lucide-react';

import Text from '@/components/atoms/Text';
import StepSection from '@/components/molecules/StepSection';
import styles from '@/components/organisms/StepResults.module.css';
import { AgeInSeconds, PackageStatData } from '@/types';
import dayjs from '@/utils/date';
import { PackageIngestResult } from '@/hooks/usePackageIngest';
import useDependencyStats from '@/hooks/useDependencyStats';
import useRegistryLookup from '@/hooks/useRegistryLookup';
import useEffectDebounced from '@/hooks/useEffectDebounced';
import JsonDownloadButton from '@/components/molecules/JsonDownloadButton';
import ProgressBar from '@/components/molecules/ProgressBar';

export type StepResultsProps = {
  className?: string;
  ingest: PackageIngestResult;
  registryUrl: string;
};
const StepResults: FunctionComponent<StepResultsProps> = ({
  className,
  ingest,
  registryUrl,
}) => {
  const columnConfig = useMemo(() => getStatColumns(), []);
  const lookup = useRegistryLookup({ registryUrl });
  const stats = useDependencyStats({ source: lookup.results });
  const data = stats?.data || [];

  useEffectDebounced(
    () => {
      void lookup.lookup(ingest?.isValid ? ingest?.dependencies : []);
    },
    200,
    [ingest, registryUrl],
  );

  return (
    <StepSection
      className={className}
      titleAction={data.length ? <JsonDownloadButton data={data} /> : null}
      title="Check the results">
      {data?.length < 1 && <Text>Complete the previous step first.</Text>}
      {lookup.progress?.total > 0 && (
        <ProgressBar
          total={lookup.progress?.total}
          current={lookup.progress?.fulfilled}
        />
      )}
      {data?.length > 0 && (
        <>
          <DataTable
            columns={columnConfig}
            data={data}
            dense
            fixedHeader
            pagination
            paginationPerPage={15}
            paginationRowsPerPageOptions={[10, 15, 30, 50, 100, 200]}
            theme="dark"
            defaultSortFieldId={'maxSatisfiedAge'}
          />
          <div className={styles.legend}>
            <div className={styles.legendSection}>
              <span>Row colors</span>
              <ul className={styles.legendList}>
                <li>
                  <div
                    className={clsx(styles.rowAlert, styles.legendColorBlock)}>
                    &nbsp;
                  </div>{' '}
                  Target max is 3+ years old
                </li>
                <li>
                  <div
                    className={clsx(
                      styles.rowWarning,
                      styles.legendColorBlock,
                    )}>
                    &nbsp;
                  </div>{' '}
                  Target max is 1.5+ years old
                </li>
              </ul>
            </div>
            <div className={styles.legendSection}>
              <span>Status?</span>
              <ul className={styles.legendList}>
                <li>👻 - Haunting packages over 5 years of neglect</li>
                <li>💀 - 3 years, lost hope</li>
                <li>🧟 - Haven&#8217;t been touched in more than 1.5 years</li>
                <li>👍 - Okay</li>
                <li>🔥 - Pretty fresh</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </StepSection>
  );
};

const YEAR_SECONDS = 365 * 24 * 60 * 60;
const humanizeAge = (age: AgeInSeconds) =>
  dayjs.duration(age, 'seconds').humanize(false);
const isAgeAlert = (age: AgeInSeconds) => age > YEAR_SECONDS * 3;
const isAgeWarning = (age: AgeInSeconds) => age > YEAR_SECONDS * 1.5;
const ageColorStyle = (
  selector: (row: PackageStatData) => AgeInSeconds,
): ConditionalStyles<PackageStatData>[] => [
  {
    when: (row) => isAgeAlert(selector(row)),
    classNames: [styles.rowAlert],
  },
  {
    when: (row) => !isAgeAlert(selector(row)) && isAgeWarning(selector(row)),
    classNames: [styles.rowWarning],
  },
];
const getStatColumns = (): TableColumn<PackageStatData>[] => [
  {
    name: 'Package',
    selector: (a) => a.package,
    sortable: true,
    grow: 2,
    format: (a) => (
      <a
        href={`https://www.npmjs.com/package/${a.package}`}
        target="_blank"
        rel="noopener noreferrer">
        <ExternalLink size={12} />
        &nbsp;
        {a.package}
      </a>
    ),
  },
  {
    name: 'Dev?',
    selector: (a) => a.isDev,
    sortable: true,
    compact: true,
    center: true,
    format: (a) => (a.isDev ? 'yes' : ''),
  },
  { name: 'Target version', selector: (a) => a.targetVersion, compact: true },
  {
    name: 'Satisfying maxium',
    selector: (a) => a.maxSatisfiedDate.format(),
    format: (a) => (
      <>
        {a.maxSatisfiedVersion}
        <br />
        {a.maxSatisfiedDate.format('l')}
      </>
    ),
  },
  {
    name: 'Latest available',
    selector: (a) => a.latestDate.format(),
    format: (a) => (
      <>
        {a.latestVersion}
        <br />
        {a.latestDate.format('l')}
      </>
    ),
  },
  {
    name: 'Satisfied max age',
    selector: (a) => a.maxSatisfiedAge,
    sortable: true,
    format: (a) => humanizeAge(a.maxSatisfiedAge),
    conditionalCellStyles: ageColorStyle((row) => row.maxSatisfiedAge),
  },
  {
    name: 'Latest release',
    selector: (a) => a.latestAge,
    sortable: true,
    format: (a) => <>{humanizeAge(a.latestAge)} ago</>,
    conditionalCellStyles: ageColorStyle((row) => row.latestAge),
  },
  {
    name: 'Status?',
    selector: (a) => a.latestAge,
    sortable: true,
    format: (a) => {
      if (a.latestAge > YEAR_SECONDS * 5) return '👻';
      if (a.latestAge > YEAR_SECONDS * 3) return '💀';
      if (a.latestAge > YEAR_SECONDS * 1.5) return '🧟';
      if (a.latestAge < YEAR_SECONDS / 2) return '🔥';
      return '👍';
    },
    maxWidth: '50px',
    right: true,
  },
];

export default StepResults;
