import { spawn } from 'child_process';
import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { ScriptMonitor } from '../src/utils/monitor';

interface TestSuite {
    name: string;
    command: string[];
    type: 'unit' | 'integration' | 'performance';
}

interface TestResult {
    suite: string;
    type: 'unit' | 'integration' | 'performance';
    duration: number;
    passed: boolean;
    error?: string;
    output: string;
}

class TestRunner {
    private results: TestResult[] = [];
    private monitor: ScriptMonitor;

    constructor() {
        this.monitor = new ScriptMonitor('token-tests');
        // Ensure reports directory exists
        mkdirSync(resolve(__dirname, '../reports'), { recursive: true });
    }

    async runSuite(suite: TestSuite): Promise<TestResult> {
        console.log(`\nRunning ${suite.name}...`);
        const startTime = Date.now();

        try {
            const output = await new Promise<string>((resolve, reject) => {
                let outputData = '';
                const process = spawn('npx', suite.command, {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    env: { ...process.env, NODE_ENV: 'test' }
                });

                process.stdout.on('data', (data) => {
                    outputData += data;
                    console.log(data.toString());
                });

                process.stderr.on('data', (data) => {
                    outputData += data;
                    console.error(data.toString());
                });

                process.on('exit', (code) => {
                    if (code === 0) {
                        resolve(outputData);
                    } else {
                        reject(new Error(`Test suite failed with code ${code}`));
                    }
                });
            });

            const result: TestResult = {
                suite: suite.name,
                type: suite.type,
                duration: Date.now() - startTime,
                passed: true,
                output
            };

            this.results.push(result);
            return result;

        } catch (error: any) {
            const result: TestResult = {
                suite: suite.name,
                type: suite.type,
                duration: Date.now() - startTime,
                passed: false,
                error: error.message,
                output: error.message
            };

            this.results.push(result);
            return result;
        }
    }

    generateReport() {
        const totalDuration = this.results.reduce((acc, r) => acc + r.duration, 0);
        const passedTests = this.results.filter(r => r.passed).length;
        const failedTests = this.results.filter(r => !r.passed).length;

        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalSuites: this.results.length,
                passedSuites: passedTests,
                failedSuites: failedTests,
                totalDuration,
                successRate: (passedTests / this.results.length) * 100
            },
            breakdownByType: {
                unit: this.summarizeType('unit'),
                integration: this.summarizeType('integration'),
                performance: this.summarizeType('performance')
            },
            suites: this.results.map(r => ({
                name: r.suite,
                type: r.type,
                duration: r.duration,
                passed: r.passed,
                error: r.error
            }))
        };

        // Save detailed report
        writeFileSync(
            resolve(__dirname, '../reports/token-test-report.json'),
            JSON.stringify(report, null, 2)
        );

        // Save test output
        writeFileSync(
            resolve(__dirname, '../reports/token-test-output.log'),
            this.results.map(r => 
                `\n=== ${r.suite} ===\n${r.output}`
            ).join('\n')
        );

        return report;
    }

    private summarizeType(type: 'unit' | 'integration' | 'performance') {
        const suites = this.results.filter(r => r.type === type);
        const passed = suites.filter(r => r.passed).length;
        
        return {
            totalSuites: suites.length,
            passedSuites: passed,
            failedSuites: suites.length - passed,
            totalDuration: suites.reduce((acc, r) => acc + r.duration, 0),
            successRate: suites.length ? (passed / suites.length) * 100 : 0
        };
    }

    printReport(report: any) {
        console.log('\n=== Test Report ===');
        console.log('Summary:');
        console.log(`Total Suites: ${report.summary.totalSuites}`);
        console.log(`Passed: ${report.summary.passedSuites}`);
        console.log(`Failed: ${report.summary.failedSuites}`);
        console.log(`Success Rate: ${report.summary.successRate.toFixed(2)}%`);
        console.log(`Total Duration: ${(report.summary.totalDuration / 1000).toFixed(2)}s`);

        console.log('\nBreakdown by Type:');
        Object.entries(report.breakdownByType).forEach(([type, stats]: [string, any]) => {
            if (stats.totalSuites > 0) {
                console.log(`\n${type.toUpperCase()}:`);
                console.log(`  Suites: ${stats.totalSuites}`);
                console.log(`  Passed: ${stats.passedSuites}`);
                console.log(`  Failed: ${stats.failedSuites}`);
                console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`);
                console.log(`  Duration: ${(stats.totalDuration / 1000).toFixed(2)}s`);
            }
        });

        if (report.summary.failedSuites > 0) {
            console.log('\nFailed Suites:');
            report.suites
                .filter((s: any) => !s.passed)
                .forEach((s: any) => {
                    console.log(`\n${s.name}:`);
                    console.log(`  Type: ${s.type}`);
                    console.log(`  Error: ${s.error}`);
                });
        }
    }
}

async function main() {
    const runner = new TestRunner();

    const suites: TestSuite[] = [
        {
            name: 'Token Unit Tests',
            command: ['mocha', '-r', 'ts-node/register', 'test/unit/more-token-tests.ts'],
            type: 'unit'
        },
        {
            name: 'Token Integration Tests',
            command: ['mocha', '-r', 'ts-node/register', 'test/integration/more-token-tests.ts'],
            type: 'integration'
        },
        {
            name: 'Token Performance Tests',
            command: ['mocha', '-r', 'ts-node/register', 'test/performance/token-performance-tests.ts'],
            type: 'performance'
        }
    ];

    try {
        for (const suite of suites) {
            await runner.runSuite(suite);
        }

        const report = runner.generateReport();
        runner.printReport(report);

        // Exit with error if any tests failed
        if (report.summary.failedSuites > 0) {
            process.exit(1);
        }
    } catch (error) {
        console.error('Test execution failed:', error);
        process.exit(1);
    }
}

main().catch(console.error); 