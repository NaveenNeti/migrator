
export type CompletionReport = {
    count: number,
    errorCount: number,
    startTime: number,
    endTime: number,
    duration: number
}

export type GeneralOptionsBuilder<T, X> = {
    loadData: (loadFunction: () => AsyncGenerator<T>) => GeneralOptionsBuilder<T, X>,
    setGetUniqueKey: (getUniqueKey: (row: T) => X) => GeneralOptionsBuilder<T, X>,
    setIsMigratedPredicate: (predicate: (row: T) => boolean) => GeneralOptionsBuilder<T, X>,
    setProcessElement: (processElement: (element: T, dryRun: boolean) => Promise<void>) => GeneralOptionsBuilder<T, X>,
    errorHandling(): ErrorOptionsBuilder<T>,
    setPhantomRowDetection(detectionFunction: (() => T[])): GeneralOptionsBuilder<T, X>,
    hooks(): HooksOptionsBuilder<T>,
    executeMigration: () => Promise<void>
}

export type ErrorOptionsBuilder<T> = {
    setIgnoreErrors: (flag: boolean) => ErrorOptionsBuilder<T>,
    setErrorThreshold: (threshold: number) => ErrorOptionsBuilder<T>,
    setDryRun: (flag: boolean) => ErrorOptionsBuilder<T>,
    setCompensatingAction: (compensatingAction: (row: T) => Promise<void>) => ErrorOptionsBuilder<T>,
    hooks(): HooksOptionsBuilder<T>
    executeMigration: () => Promise<void>
}

export type HooksOptionsBuilder<Y> = {
    beforeProcessing(beforeHook: ((row: Y) => Promise<void>)): HooksOptionsBuilder<Y>
    afterProcessing(afterHook: ((row: Y) => Promise<void>)): HooksOptionsBuilder<Y>
    onError(errorHook: ((err: Error) => Promise<void>)): HooksOptionsBuilder<Y>
    onCompletion(onCompletion: (result: CompletionReport) => Promise<void>): HooksOptionsBuilder<Y>
    setInterceptRow: (interceptRow: (row: Y) => Y) => HooksOptionsBuilder<Y>
    errorHandling(): ErrorOptionsBuilder<Y>
    executeMigration: () => Promise<void>
}

export class MigratorBuilder<T, X extends string> implements GeneralOptionsBuilder<T, X>, ErrorOptionsBuilder<T>, HooksOptionsBuilder<T> {
    /** General options */
    private streamReference: (() => AsyncGenerator<T>) | undefined;
    private predicate: (row: T) => boolean;
    private getUniqueKey: ((row: T) => X) | undefined;
    private processElement: (element: T, dryRun: boolean) => Promise<void>;
    private interceptRow: (row: T) => T;
    private phantomRowDetection?: (() => T[]);
    
    /** Error handling options */
    private ignoreErrors: boolean = false;
    private dryRun: boolean = false;
    private errorThreshold: number = 0
    private compensatingAction?: (row: T) => Promise<void>;
    private totalErrorCount: number = 0;

    /** Internal state  */
    private count = 0;
    private errorCount = 0;
    private state: Map<string, string> = new Map();
    private startTime: number = 0;
    private endTime: number = 0;

    /** Hooks option */
    private beforeHook?: (row: T) => Promise<void>;
    private afterHook?: (row: T) => Promise<void>;
    private errorHook?: (error: any) => Promise<void>;
    private completionHook?: (result: CompletionReport) => Promise<void>;

    static builder<T, X extends string>(): GeneralOptionsBuilder<T, X> {
        return new MigratorBuilder<T, X>();
    }

    constructor() {
        process.on('SIGINT', () => {
            console.log(`Last started row: ${this.state.get('currentRow')}`);
            console.log(`Last completed row: ${this.state.get('lastCompletedRow')}`);
            if (this.state.get('currentRow') !== this.state.get('lastCompletedRow')) {
                console.log(`Migration interrupted, item with id ${this.state.get('currentRow')} may not be fully processed or a corrupt state`)
            }
            console.log(Date.now());
            process.exit(1);
        });
    
        process.on('SIGTERM', () => {
            console.log(`Last started row: ${this.state.get('currentRow')}`);
            console.log(`Last completed row: ${this.state.get('lastCompletedRow')}`);
            if (this.state.get('currentRow') !== this.state.get('lastCompletedRow')) {
                console.log(`Migration interrupted, item with id ${this.state.get('currentRow')} may not be fully processed or a corrupt state`)
            }
            console.log(Date.now());
            process.exit(1);
        });

        this.predicate = () => true;
        this.processElement = () => { return Promise.resolve()};
        this.interceptRow = (row: T) => row;
    }

    beforeProcessing(beforeHook: (row: T) => Promise<void>): HooksOptionsBuilder<T> {
        this.beforeHook = beforeHook;
        return this;
    }

    afterProcessing(afterHook: (row: T) => Promise<void>): HooksOptionsBuilder<T> {
        this.afterHook = afterHook;
        return this;
    }

    onError(errorHook: (err: Error) => Promise<void>): HooksOptionsBuilder<T> {
        this.errorHook = errorHook;
        return this;
    }

    onCompletion(onCompletion: (result: CompletionReport) => Promise<void>): HooksOptionsBuilder<T> {
        this.completionHook = onCompletion;
        return this;
    }

    setPhantomRowDetection(phantomRowDetection: () => T[]): GeneralOptionsBuilder<T, X> {
        this.phantomRowDetection = phantomRowDetection;
        return this;
    }

    loadData(loadFunction: () => AsyncGenerator<T>): GeneralOptionsBuilder<T, X> {
        this.streamReference = loadFunction;
        return this;
    }

    errorHandling(): ErrorOptionsBuilder<T> {
        return this;
    }

    setIgnoreErrors(flag: boolean): ErrorOptionsBuilder<T> {
        this.ignoreErrors = flag;
        return this;
    }

    setErrorThreshold(threshold: number): ErrorOptionsBuilder<T> {
        this.errorThreshold = threshold;
        return this;
    }

    hooks(): HooksOptionsBuilder<T> {
        return this;
    }

    setCompensatingAction(compensatingAction: (row: T) => Promise<void>): ErrorOptionsBuilder<T> {
        this.compensatingAction = compensatingAction;
        return this;
    }

    setGetUniqueKey(getUniqueKey: (row: T) => X): GeneralOptionsBuilder<T, X> {
        this.getUniqueKey = getUniqueKey;
        return this;
    }

    setDryRun(flag: boolean): ErrorOptionsBuilder<T> {
        this.dryRun = flag;
        return this;
    }

    setIsMigratedPredicate(predicate: (row: T) => boolean): GeneralOptionsBuilder<T, X> {
        this.predicate = predicate;
        return this;
    }

    setProcessElement(processElement: (element: T, dryRun: boolean) => Promise<void>): GeneralOptionsBuilder<T, X> {
        this.processElement = processElement;
        return this;
    }

    setInterceptRow(interceptRow: (row: T) => T): HooksOptionsBuilder<T> {
        this.interceptRow = interceptRow;
        return this;
    }

    async executeMigration() {
        let errorCount = 0;

        this.startTime = Date.now();
        for await (let row of this.streamReference!()) {
            if (this.predicate(row)) {
                try {
                    this.state.set('currentRow', this.getUniqueKey!(row));
                    if (this.beforeHook) {
                        await this.beforeHook(row);
                    }
                    let interceptedRow = this.interceptRow(row);
                    await this.processElement(interceptedRow, this.dryRun);
                    if (this.afterHook) {
                        await this.afterHook(row);
                    }
                    errorCount = 0;
                    this.count++;
                    this.state.set('lastCompletedRow', this.getUniqueKey!(row));
                } catch (error) {
                    this.totalErrorCount++;
                    if (this.errorHook) {
                        await this.errorHook(error);
                    }
                    errorCount++;
                    console.error(`Error processing row with key: ${this.getUniqueKey!(row)} - ${this.errorCount} errors so far.`);
                    console.error(error);
                    if (!this.ignoreErrors) {
                        if (this.compensatingAction) {
                            console.log(`Attempting to compensate for error`);
                            try {
                                await this.compensatingAction(row);
                                console.log(`Compensation successful for row with key: ${this.getUniqueKey!(row)}`);
                            } catch (compensationError) {
                                console.error(`Error compensating for row with key: ${this.getUniqueKey!(row)}`);
                                console.error(compensationError);
                            }
                        }

                        if (this.errorCount > this.errorThreshold) {
                            console.log(`Error threshold reached, exiting migration`);
                            break;
                        }
                    }
                }

            }
        }
        this.endTime = Date.now();
        if (this.completionHook) {
            await this.completionHook({
                count: this.count,
                errorCount: this.totalErrorCount,
                startTime: this.startTime,
                endTime: this.endTime,
                duration: this.endTime - this.startTime
            });
        }
        if (this.phantomRowDetection) {
            const results = this.phantomRowDetection();
            console.log(`${results.length} phantom rows detected`);
        }
    }
}

// Backup and restore
// Retries?
// Inject data sources
