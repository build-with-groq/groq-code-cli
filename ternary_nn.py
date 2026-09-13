'''Simple neural network that learns to convert a fixed‑length ternary number to its decimal value.

The network takes a vector of ternary digits (0, 1, 2) of length N and predicts the integer
value in the range [0, 3**N - 1]. We generate all possible inputs, train a small feed‑forward
network with PyTorch, and demonstrate that it learns the exact mapping.
''' 

import itertools
import torch
import torch.nn as nn
import torch.optim as optim

# Configuration
N_DIGITS = 5               # Length of ternary number
MAX_VAL = 3 ** N_DIGITS    # Maximum decimal value (exclusive)

# Helper: convert integer to ternary digit list (most‑significant first)
def int_to_ternary(x: int, length: int = N_DIGITS) -> list[int]:
    digits = []
    for _ in range(length):
        digits.append(x % 3)
        x //= 3
    return list(reversed(digits))

# Prepare dataset: all possible ternary numbers
inputs = []
targets = []
for i in range(MAX_VAL):
    tern = int_to_ternary(i)
    inputs.append(tern)
    targets.append(i)

# Convert to tensors
X = torch.tensor(inputs, dtype=torch.float32)          # shape: (MAX_VAL, N_DIGITS)
# Scale inputs to [0, 1] range – optional but helps training
X = X / 2.0
y = torch.tensor(targets, dtype=torch.float32).unsqueeze(1)  # shape: (MAX_VAL, 1)

# Simple feed‑forward model
class TernaryNet(nn.Module):
    def __init__(self, in_features: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, 64),
            nn.ReLU(),
            nn.Linear(64, 64),
            nn.ReLU(),
            nn.Linear(64, 1)  # regression output
        )
    def forward(self, x):
        return self.net(x)

model = TernaryNet(N_DIGITS)
criterion = nn.MSELoss()
optimizer = optim.Adam(model.parameters(), lr=0.01)

# Training loop
epochs = 500
for epoch in range(epochs):
    model.train()
    optimizer.zero_grad()
    outputs = model(X)
    loss = criterion(outputs, y)
    loss.backward()
    optimizer.step()
    if (epoch + 1) % 100 == 0:
        print(f"Epoch {epoch+1}/{epochs}, Loss: {loss.item():.4f}")

# Evaluation
model.eval()
with torch.no_grad():
    preds = model(X).squeeze()
    # Round predictions to nearest integer and clamp to valid range
    preds_int = torch.round(preds).clamp(0, MAX_VAL - 1).int()
    accuracy = (preds_int == y.squeeze().int()).float().mean()
    print(f"Accuracy: {accuracy.item() * 100:.2f}%")

# Demo: predict a random ternary number
import random
sample = random.randint(0, MAX_VAL - 1)
sample_tern = int_to_ternary(sample)
model_input = torch.tensor(sample_tern, dtype=torch.float32).unsqueeze(0) / 2.0
with torch.no_grad():
    pred = model(model_input).item()
    print(f"Ternary {sample_tern} -> true {sample}, predicted {pred:.2f}")
