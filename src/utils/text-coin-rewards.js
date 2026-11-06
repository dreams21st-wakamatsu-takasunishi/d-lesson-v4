// Preserve text-practice thresholds; mock exams use the certification boundaries.
const REWARDS = [
    [2001, 2000, 15000], [1501, 1500, 10000], [1001, 1000, 8500],
    [801, 800, 5000], [601, 600, 2500], [451, 450, 1000],
    [351, 350, 500], [251, 250, 100], [101, 100, 50],
    [51, 50, 30], [1, 1, 20]
];

export function getTextCoinReward(netCount) {
    return REWARDS.find(([minimum]) => Number(netCount) >= minimum)?.[2] || 0;
}

export function getMockExamCoinReward(netCount) {
    return (REWARDS.find(([, minimum]) => Number(netCount) >= minimum)?.[2] || 0) * 1.5;
}
