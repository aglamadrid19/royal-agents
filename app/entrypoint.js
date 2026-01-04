import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import "@ethersproject/shims";
import "fast-text-encoding";
import { Buffer } from "buffer";

global.Buffer = Buffer;

import "expo-router/entry";
